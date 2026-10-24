import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { MenuItem } from '@restaurant/contracts';
import { formatMoney } from '@shared/util/money';
import { MENU_ROW_HEIGHT } from './menu-row-height';

export interface MenuItemAdd {
  item: MenuItem;
  quantity: number;
}

export const MAX_QUANTITY = 99;

/**
 * One menu item. Receives the item as a signal input, so a live update re-renders only this row.
 * The quantity resets when the row is reused for another item by the virtual scroll.
 */
@Component({
  selector: 'app-menu-item-row',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.height.px]': 'rowHeight' },
  template: `
    <div class="row" [class.row--unavailable]="!item().available">
      <div class="text">
        <span class="name">{{ item().name }}</span>
        <span class="meta">
          @if (!item().available) {
            <span class="badge">Unavailable</span>
          }
          {{ item().description }}
        </span>
      </div>
      <span class="price">{{ priceLabel() }}</span>
      <div class="stepper" role="group" [attr.aria-label]="'Quantity of ' + item().name">
        <button
          mat-icon-button
          type="button"
          aria-label="Decrease quantity"
          matTooltip="Decrease quantity"
          [disabled]="!item().available || quantity() <= 1"
          (click)="quantity.set(quantity() - 1)"
        >
          <mat-icon>remove</mat-icon>
        </button>
        <span class="quantity" aria-live="polite">{{ quantity() }}</span>
        <button
          mat-icon-button
          type="button"
          aria-label="Increase quantity"
          matTooltip="Increase quantity"
          [disabled]="!item().available || quantity() >= maxQuantity"
          (click)="quantity.set(quantity() + 1)"
        >
          <mat-icon>add</mat-icon>
        </button>
      </div>
      <button
        mat-flat-button
        type="button"
        class="add"
        [disabled]="!item().available"
        [attr.aria-label]="'Add ' + item().name + ' to cart'"
        (click)="add.emit({ item: item(), quantity: quantity() })"
      >
        {{ isOpenPrice() ? 'Add…' : 'Add' }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
      box-sizing: border-box;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 100%;
      padding: 0 16px;
    }
    .row--unavailable .text,
    .row--unavailable .price {
      opacity: 0.5;
    }
    .text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }
    .name,
    .meta {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .name {
      font: var(--mat-sys-title-small);
    }
    .meta {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .badge {
      padding: 0 6px;
      margin-right: 4px;
      border-radius: 4px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    .price {
      flex: none;
      width: 150px;
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .stepper {
      flex: none;
      display: flex;
      align-items: center;
    }
    .quantity {
      width: 24px;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .add {
      flex: none;
    }
  `,
})
export class MenuItemRowComponent {
  readonly item = input.required<MenuItem>();
  readonly add = output<MenuItemAdd>();

  protected readonly rowHeight = MENU_ROW_HEIGHT;
  protected readonly maxQuantity = MAX_QUANTITY;
  protected readonly quantity = linkedSignal({ source: () => this.item().id, computation: () => 1 });
  protected readonly isOpenPrice = computed(() => this.item().pricing.kind === 'open');
  protected readonly priceLabel = computed(() => {
    const pricing = this.item().pricing;
    return pricing.kind === 'fixed' ? formatMoney(pricing.price) : 'Set your price';
  });
}
