import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { Store } from '@ngrx/store';
import { ErrorStateComponent } from '@shared/ui';
import {
  OrdersPageActions,
  ordersFeature,
  selectOrderEntities,
  selectOrderIdsNewestFirst,
  selectOrdersIsEmptyLoading,
} from '@orders/data-access';
import { OrderCardComponent } from '@orders/ui/order-card.component';

@Component({
  selector: 'app-orders-page',
  imports: [RouterLink, MatButtonModule, ErrorStateComponent, OrderCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <h1>Orders</h1>
      @if (status() === 'error' && ids().length === 0) {
        <app-error-state
          title="Orders could not be loaded"
          [message]="error()?.message ?? 'Please try again.'"
          (retry)="retry()"
        />
      } @else {
        @if (status() === 'error') {
          <p class="inline-error" role="alert">
            {{ error()?.message }}
            <button mat-button type="button" (click)="retry()">Retry</button>
          </p>
        }
        @if (showSkeleton()) {
          @for (index of skeletons; track index) {
            <div class="skeleton" aria-hidden="true"></div>
          }
        } @else if (ids().length === 0) {
          <p class="empty">No orders yet.</p>
          <a mat-flat-button routerLink="/menu">Browse the menu</a>
        } @else {
          <div class="list">
            @for (id of ids(); track id) {
              @if (entities()[id]; as order) {
                <app-order-card [order]="order" [highlighted]="order.id === highlight()" />
              }
            }
          </div>
        }
      }
    </section>
  `,
  styles: `
    .page {
      max-width: 720px;
      margin: 0 auto;
      padding: 16px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .skeleton {
      height: 128px;
      margin-bottom: 12px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
    }
    .empty {
      color: var(--mat-sys-on-surface-variant);
    }
    .inline-error {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--mat-sys-error);
    }
  `,
})
export class OrdersPageComponent {
  private readonly store = inject(Store);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** `?highlight=<id>`: the order just placed. Bound by the router. */
  readonly highlight = input<string | undefined>();

  protected readonly skeletons = [0, 1, 2];
  protected readonly ids = this.store.selectSignal(selectOrderIdsNewestFirst);
  protected readonly entities = this.store.selectSignal(selectOrderEntities);
  protected readonly status = this.store.selectSignal(ordersFeature.selectStatus);
  protected readonly error = this.store.selectSignal(ordersFeature.selectError);
  protected readonly showSkeleton = this.store.selectSignal(selectOrdersIsEmptyLoading);
  private readonly highlightShown = computed(() => {
    const id = this.highlight();
    return id !== undefined && this.ids().includes(id) ? id : null;
  });
  private scrolledTo: string | null = null;

  constructor() {
    // Scrolls once to the highlighted order as soon as it is rendered.
    afterRenderEffect(() => {
      const id = this.highlightShown();
      if (!id || id === this.scrolledTo) return;
      const card = this.host.nativeElement.querySelector(`[data-order-id="${CSS.escape(id)}"]`);
      if (!card) return;
      this.scrolledTo = id;
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  protected retry(): void {
    this.store.dispatch(OrdersPageActions.retryClicked());
  }
}
