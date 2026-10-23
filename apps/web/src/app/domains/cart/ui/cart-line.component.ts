import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { MenuChange, Minor } from '@restaurant/contracts';
import { formatMoney } from '@shared/util/money';

/** Mirrors `CartLineView` from data-access; ui components do not import the store layer. */
export interface CartLineViewModel {
  line: { id: string; name: string; unitPrice: Minor; quantity: number; priceKind: 'fixed' | 'open' };
  lineTotal: Minor;
  issue: MenuChange | null;
}

export const CART_MAX_QUANTITY = 99;

@Component({
  selector: 'app-cart-line',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="line" [class.line--issue]="!!view().issue">
      <div class="text">
        <span class="name">{{ view().line.name }}</span>
        <span class="unit">
          {{ unitLabel() }}
          @if (view().line.priceKind === 'open') {
            <span class="tag">your price</span>
          }
        </span>
        @if (issueText(); as text) {
          <span class="issue" role="status">
            {{ text }}
            @if (view().issue?.kind === 'price_changed') {
              <button mat-button type="button" [disabled]="disabled()" (click)="acceptPrice.emit()">Use new price</button>
            }
          </span>
        }
      </div>
      <div class="stepper" role="group" [attr.aria-label]="'Quantity of ' + view().line.name">
        <button
          mat-button
          type="button"
          aria-label="Decrease quantity"
          [disabled]="disabled() || view().line.quantity <= 1"
          (click)="quantityChange.emit(view().line.quantity - 1)"
        >
          −
        </button>
        <span class="quantity">{{ view().line.quantity }}</span>
        <button
          mat-button
          type="button"
          aria-label="Increase quantity"
          [disabled]="disabled() || view().line.quantity >= maxQuantity"
          (click)="quantityChange.emit(view().line.quantity + 1)"
        >
          +
        </button>
      </div>
      <span class="total">{{ totalLabel() }}</span>
      <button
        mat-button
        type="button"
        [attr.aria-label]="'Remove ' + view().line.name"
        [disabled]="disabled()"
        (click)="remove.emit()"
      >
        Remove
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .line {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
    }
    .line--issue {
      background: color-mix(in srgb, var(--mat-sys-error-container) 35%, transparent);
    }
    .text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .name {
      font: var(--mat-sys-title-small);
    }
    .unit {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .tag {
      margin-left: 4px;
      padding: 0 6px;
      border-radius: 4px;
      background: var(--mat-sys-secondary-container);
    }
    .issue {
      display: flex;
      align-items: center;
      gap: 4px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-error);
    }
    .stepper {
      display: flex;
      align-items: center;
    }
    .stepper button {
      min-width: 36px;
      padding: 0;
    }
    .quantity {
      width: 24px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .total {
      width: 120px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class CartLineComponent {
  readonly view = input.required<CartLineViewModel>();
  /** True while the cart is locked by a checkout attempt. */
  readonly disabled = input(false);
  readonly quantityChange = output<number>();
  readonly remove = output();
  readonly acceptPrice = output();

  protected readonly maxQuantity = CART_MAX_QUANTITY;
  protected readonly unitLabel = computed(() => `${formatMoney(this.view().line.unitPrice)} each`);
  protected readonly totalLabel = computed(() => formatMoney(this.view().lineTotal));
  protected readonly issueText = computed(() => {
    const issue = this.view().issue;
    switch (issue?.kind) {
      case 'removed':
        return 'No longer on the menu. Remove it to continue.';
      case 'unavailable':
        return 'Currently unavailable. Remove it to continue.';
      case 'price_changed':
        return `Price changed to ${formatMoney(issue.current)}.`;
      case 'open_price_out_of_range':
        return `Price must now be from ${formatMoney(issue.min)} to ${formatMoney(issue.max)}.`;
      default:
        return null;
    }
  });
}
