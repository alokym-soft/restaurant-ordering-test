import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import type { MenuItem } from '@restaurant/contracts';
import { formatMoney } from '@shared/util/money';

export const SETUP_ROW_HEIGHT = 56;

@Component({
  selector: 'app-setup-item-row',
  imports: [MatButtonModule, MatSlideToggleModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-item-id]': 'item().id', '[class.selected]': 'selected()' },
  template: `
    <button type="button" class="open" [attr.aria-label]="'Edit ' + item().name" (click)="open.emit()">
      <span class="name">{{ item().name }}</span>
      <span class="price">{{ priceLabel() }}</span>
    </button>
    <span class="pending" [class.pending--visible]="pending()" aria-live="polite">
      {{ pending() ? 'Saving…' : '' }}
    </span>
    <mat-slide-toggle
      [checked]="item().available"
      [disabled]="pending()"
      [attr.aria-label]="'Available: ' + item().name"
      (change)="availabilityChange.emit($event.checked)"
    />
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      height: 56px;
      padding: 0 12px;
      box-sizing: border-box;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    :host(.selected) {
      background: var(--mat-sys-secondary-container);
    }
    .open {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: baseline;
      gap: 12px;
      height: 100%;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
    }
    .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font: var(--mat-sys-title-small);
    }
    .price {
      font-variant-numeric: tabular-nums;
      color: var(--mat-sys-on-surface-variant);
    }
    .pending {
      width: 56px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class SetupItemRowComponent {
  readonly item = input.required<MenuItem>();
  readonly pending = input(false);
  readonly selected = input(false);
  readonly open = output();
  readonly availabilityChange = output<boolean>();

  protected readonly priceLabel = computed(() => {
    const pricing = this.item().pricing;
    return pricing.kind === 'fixed'
      ? formatMoney(pricing.price)
      : `${formatMoney(pricing.min)} – ${formatMoney(pricing.max)}`;
  });
}
