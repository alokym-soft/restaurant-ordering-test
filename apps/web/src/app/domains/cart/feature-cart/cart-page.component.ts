import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Store } from '@ngrx/store';
import { firstValueFrom } from 'rxjs';
import { connectionFeature } from '@core/realtime';
import { ConfirmDialogComponent, type ConfirmDialogData } from '@shared/ui';
import { CURRENCY_SYMBOL, parseMoney, toMajorString } from '@shared/util/money';
import {
  CartPageActions,
  type CartLineView,
  cartFeature,
  selectCartHasIssues,
  selectCartIsLocked,
  selectCartLineViews,
  selectCartTotals,
  selectCheckout,
  selectCheckoutReview,
  selectCheckoutStatus,
} from '@cart/data-access';
import { CartLineComponent } from '@cart/ui/cart-line.component';
import { CartSummaryComponent } from '@cart/ui/cart-summary.component';
import {
  MenuChangesDialogComponent,
  type MenuChangesDialogData,
  type MenuChangesDialogResult,
} from '@cart/ui/menu-changes-dialog.component';

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
        @if (checkoutStatus() === 'failed') {
          <div class="alert" role="alert">
            <p>{{ checkoutError()?.message }}</p>
            <p>
              Your order may have been placed. Retrying is safe: it cannot create a second order. The cart is locked
              until the order is confirmed.
            </p>
            <div class="alert-actions">
              <button mat-flat-button type="button" [disabled]="!online()" (click)="retry()">Retry</button>
              <a mat-button routerLink="/orders">Check orders</a>
              <button mat-button type="button" (click)="unlock()">Edit cart</button>
            </div>
          </div>
        } @else if (checkoutError(); as error) {
          <p class="alert" role="alert">{{ error.message }}</p>
        } @else if (hasIssues()) {
          <p class="alert" role="alert">Some items changed since you added them. Review the highlighted lines.</p>
        }
        <div class="lines">
          @for (view of lines(); track view.line.id) {
            <app-cart-line
              [view]="view"
              [disabled]="locked()"
              (quantityChange)="changeQuantity(view, $event)"
              (remove)="remove(view)"
              (acceptPrice)="acceptPrice(view)"
            />
          }
        </div>
        <div class="bottom">
          <mat-form-field class="discount">
            <mat-label>Discount</mat-label>
            <span matTextPrefix>{{ currencySymbol }}&nbsp;</span>
            <input
              matInput
              inputmode="decimal"
              autocomplete="off"
              [value]="discountText()"
              [disabled]="locked()"
              (input)="changeDiscount($event)"
            />
            @if (discountInvalid()) {
              <mat-hint class="hint-error">Enter an amount like 50 or 50.25</mat-hint>
            }
          </mat-form-field>
          <div class="summary">
            <app-cart-summary [totals]="totals()" />
            @if (checkoutStatus() !== 'failed') {
              <button mat-flat-button type="button" class="checkout" [disabled]="!canCheckout()" (click)="checkout()">
                {{ checkoutStatus() === 'submitting' ? 'Placing order…' : 'Place order' }}
              </button>
            }
            @if (!online()) {
              <p class="hint">You are offline. Orders can be placed when the connection is back.</p>
            }
          </div>
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
    .empty,
    .hint {
      color: var(--mat-sys-on-surface-variant);
    }
    .alert {
      padding: 8px 16px;
      border-radius: 8px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .alert p {
      margin: 8px 0;
    }
    .alert-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
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
    .discount,
    .summary {
      flex: 0 1 320px;
    }
    .summary {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .hint-error {
      color: var(--mat-sys-error);
    }
  `,
})
export class CartPageComponent {
  protected readonly currencySymbol = CURRENCY_SYMBOL;
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);

  protected readonly lines = this.store.selectSignal(selectCartLineViews);
  protected readonly totals = this.store.selectSignal(selectCartTotals);
  protected readonly hasIssues = this.store.selectSignal(selectCartHasIssues);
  protected readonly checkoutStatus = this.store.selectSignal(selectCheckoutStatus);
  protected readonly locked = this.store.selectSignal(selectCartIsLocked);
  protected readonly online = this.store.selectSignal(connectionFeature.selectIsOnline);
  private readonly checkoutState = this.store.selectSignal(selectCheckout);
  private readonly review = this.store.selectSignal(selectCheckoutReview);
  private reviewOpen = false;

  protected readonly checkoutError = computed(() => this.checkoutState().error);

  // Local input text, seeded once; the store only receives valid amounts.
  private readonly initialDiscount = this.store.selectSignal(cartFeature.selectDiscount)();
  protected readonly discountText = signal(this.initialDiscount > 0 ? toMajorString(this.initialDiscount) : '');
  protected readonly discountInvalid = signal(false);

  protected readonly canCheckout = computed(
    () => this.online() && !this.locked() && !this.discountInvalid() && this.lines().length > 0,
  );

  constructor() {
    effect(() => {
      if (this.checkoutStatus() === 'changes' && !this.reviewOpen) untracked(() => void this.openReview());
    });
  }

  /** Shows every affected line with its outcome; only what the user saw is applied. */
  private async openReview(): Promise<void> {
    const rows = this.review();
    if (rows.length === 0) {
      this.store.dispatch(CartPageActions.changesDismissed());
      return;
    }
    this.reviewOpen = true;
    const removed = rows.filter((row) => row.outcome.kind === 'remove').length;
    const ref = this.dialog.open<MenuChangesDialogComponent, MenuChangesDialogData, MenuChangesDialogResult>(
      MenuChangesDialogComponent,
      { data: { rows, cartWillBeEmpty: removed === this.lines().length }, width: '480px' },
    );
    const accepted = await firstValueFrom(ref.afterClosed());
    this.reviewOpen = false;
    this.store.dispatch(
      accepted ? CartPageActions.changesAccepted({ resolutions: rows }) : CartPageActions.changesDismissed(),
    );
  }

  protected checkout(): void {
    this.store.dispatch(CartPageActions.checkoutClicked());
  }

  protected retry(): void {
    this.store.dispatch(CartPageActions.retryClicked());
  }

  /** Unlocking is explicit: the unconfirmed attempt may already have created the order. */
  protected async unlock(): Promise<void> {
    const ref = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      data: {
        title: 'Edit the cart?',
        message:
          'Your previous attempt may have gone through. Check your orders first: once you change the cart, ' +
          'placing it again creates a separate order.',
        confirmLabel: 'Edit anyway',
        cancelLabel: 'Keep it locked',
      },
      width: '420px',
    });
    if (await firstValueFrom(ref.afterClosed())) this.store.dispatch(CartPageActions.editUnlocked());
  }

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
