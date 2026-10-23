import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { parseMoney, toMajorString } from '@shared/util/money';
import {
  CartPageActions,
  type CartLineView,
  cartFeature,
  selectCartHasIssues,
  selectCartLineViews,
  selectCartTotals,
} from '@cart/data-access';
import { CartLineComponent } from '@cart/ui/cart-line.component';
import { CartSummaryComponent } from '@cart/ui/cart-summary.component';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, MatButtonModule, MatFormFieldModule, MatInputModule, CartLineComponent, CartSummaryComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page">
      <h1>Cart</h1>
      @if (lines().length === 0) {
        <p class="empty">Your cart is empty.</p>
        <a mat-flat-button routerLink="/menu">Browse the menu</a>
      } @else {
        @if (hasIssues()) {
          <p class="issues" role="alert">Some items changed since you added them. Review the highlighted lines.</p>
        }
        <div class="lines">
          @for (view of lines(); track view.line.id) {
            <app-cart-line
              [view]="view"
              (quantityChange)="changeQuantity(view, $event)"
              (remove)="remove(view)"
              (acceptPrice)="acceptPrice(view)"
            />
          }
        </div>
        <div class="bottom">
          <mat-form-field class="discount">
            <mat-label>Discount, ₴</mat-label>
            <input
              matInput
              inputmode="decimal"
              autocomplete="off"
              [value]="discountText()"
              (input)="changeDiscount($event)"
            />
            @if (discountInvalid()) {
              <mat-hint class="hint-error">Enter an amount like 50 or 50.25</mat-hint>
            }
          </mat-form-field>
          <app-cart-summary class="summary" [totals]="totals()" />
        </div>
      }
    </section>
  `,
  styles: `
    .page {
      max-width: 960px;
      margin: 0 auto;
      padding: 16px;
    }
    .empty {
      color: var(--mat-sys-on-surface-variant);
    }
    .issues {
      padding: 8px 16px;
      border-radius: 8px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .lines {
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .bottom {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 24px;
      margin-top: 16px;
    }
    .summary {
      flex: 0 1 320px;
    }
    .hint-error {
      color: var(--mat-sys-error);
    }
  `,
})
export class CartPageComponent {
  private readonly store = inject(Store);

  protected readonly lines = this.store.selectSignal(selectCartLineViews);
  protected readonly totals = this.store.selectSignal(selectCartTotals);
  protected readonly hasIssues = this.store.selectSignal(selectCartHasIssues);

  // Local input text, seeded once; the store only receives valid amounts.
  private readonly initialDiscount = this.store.selectSignal(cartFeature.selectDiscount)();
  protected readonly discountText = signal(this.initialDiscount > 0 ? toMajorString(this.initialDiscount) : '');
  protected readonly discountInvalid = signal(false);

  protected changeQuantity(view: CartLineView, quantity: number): void {
    this.store.dispatch(CartPageActions.quantityChanged({ lineId: view.line.id, quantity }));
  }

  protected remove(view: CartLineView): void {
    this.store.dispatch(CartPageActions.lineRemoved({ lineId: view.line.id }));
  }

  protected acceptPrice(view: CartLineView): void {
    const issue = view.issue;
    if (issue?.kind !== 'price_changed' || view.currentItemVersion === null) return;
    this.store.dispatch(
      CartPageActions.priceAccepted({
        lineId: view.line.id,
        unitPrice: issue.current,
        itemVersion: view.currentItemVersion,
      }),
    );
  }

  protected changeDiscount(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.discountText.set(text);
    const discount = text.trim() === '' ? 0 : parseMoney(text);
    this.discountInvalid.set(discount === null);
    if (discount !== null) this.store.dispatch(CartPageActions.discountChanged({ discount }));
  }
}
