import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Order } from '@restaurant/contracts';
import { formatDateTime } from '@shared/util/date';
import { formatMoney } from '@shared/util/money';
import { StatusBadgeComponent } from './status-badge.component';

@Component({
  selector: 'app-order-card',
  imports: [StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.highlighted]': 'highlighted()', '[attr.data-order-id]': 'order().id' },
  template: `
    <article class="card" [attr.aria-label]="'Order ' + order().number">
      <header class="head">
        <h2 class="number">#{{ order().number }}</h2>
        <time class="time" [attr.datetime]="order().createdAt">{{ createdAt() }}</time>
        <app-status-badge [status]="order().status" />
      </header>
      <ul class="lines">
        @for (line of order().lines; track line.itemId + '@' + line.unitPrice) {
          <li>
            <span>{{ line.quantity }} × {{ line.name }}</span>
            <span class="amount">{{ format(line.lineTotal) }}</span>
          </li>
        }
      </ul>
      <footer class="totals">
        @if (order().discount > 0) {
          <span class="discount">Discount −{{ format(order().discount) }}</span>
        }
        <strong class="amount">{{ total() }}</strong>
      </footer>
    </article>
  `,
  styles: `
    :host {
      display: block;
      border-radius: 12px;
      outline: 2px solid transparent;
      transition: outline-color 0.3s;
    }
    :host(.highlighted) {
      outline-color: var(--mat-sys-primary);
    }
    .card {
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low);
    }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .number {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }
    .time {
      flex: 1;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .lines {
      margin: 8px 0;
      padding: 0;
      list-style: none;
    }
    .lines li,
    .totals {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .totals {
      justify-content: flex-end;
      align-items: baseline;
    }
    .discount {
      color: var(--mat-sys-on-surface-variant);
    }
    .amount {
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class OrderCardComponent {
  readonly order = input.required<Order>();
  readonly highlighted = input(false);

  protected readonly format = formatMoney;
  protected readonly total = computed(() => formatMoney(this.order().total));
  protected readonly createdAt = computed(() => formatDateTime(this.order().createdAt));
}
