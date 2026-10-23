import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Minor } from '@restaurant/contracts';
import { formatMoney } from '@shared/util/money';

export interface CartTotalsViewModel {
  subtotal: Minor;
  requestedDiscount: Minor;
  discount: Minor;
  total: Minor;
}

@Component({
  selector: 'app-cart-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="summary">
      <div class="row">
        <dt>Subtotal</dt>
        <dd>{{ format(totals().subtotal) }}</dd>
      </div>
      <div class="row">
        <dt>Discount</dt>
        <dd>−{{ format(totals().discount) }}</dd>
      </div>
      @if (totals().requestedDiscount > totals().discount) {
        <p class="note">The discount is limited to the subtotal.</p>
      }
      <div class="row row--total">
        <dt>Total</dt>
        <dd>{{ format(totals().total) }}</dd>
      </div>
    </dl>
  `,
  styles: `
    .summary {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .row {
      display: flex;
      justify-content: space-between;
    }
    dt,
    dd {
      margin: 0;
    }
    dd {
      font-variant-numeric: tabular-nums;
    }
    .row--total {
      margin-top: 8px;
      font: var(--mat-sys-title-medium);
    }
    .note {
      margin: 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class CartSummaryComponent {
  readonly totals = input.required<CartTotalsViewModel>();
  protected readonly format = formatMoney;
}
