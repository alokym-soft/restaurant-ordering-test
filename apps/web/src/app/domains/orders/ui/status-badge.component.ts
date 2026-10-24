import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { OrderStatus } from '@restaurant/contracts';

const LABELS: Record<OrderStatus, string> = {
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

/** Fixed width, so a status change never moves the surrounding layout. */
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="'badge badge--' + status()" role="status">{{ label() }}</span>`,
  styles: `
    .badge {
      display: inline-block;
      width: 96px;
      padding: 2px 0;
      border-radius: 12px;
      text-align: center;
      font: var(--mat-sys-label-medium);
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
    }
    .badge--preparing {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .badge--ready {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    .badge--completed {
      color: var(--mat-sys-on-surface-variant);
    }
    .badge--cancelled {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<OrderStatus>();
  protected readonly label = computed(() => LABELS[this.status()]);
}
