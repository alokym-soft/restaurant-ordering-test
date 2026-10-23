import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { ConnectionStatus } from '@core/realtime';

/** Non-blocking connection banner, fixed to the bottom so it never shifts the layout. */
@Component({
  selector: 'app-connection-banner',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (message(); as text) {
      <div class="banner" [class.banner--error]="status() === 'error'" role="status" aria-live="polite">
        <span>{{ text }}</span>
        @if (status() === 'reconnecting') {
          <button mat-button type="button" (click)="retry.emit()">Retry now</button>
        }
        @if (status() === 'error') {
          <button mat-button type="button" (click)="reload.emit()">Reload</button>
        }
      </div>
    }
  `,
  styles: `
    .banner {
      position: fixed;
      inset-inline: 0;
      bottom: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 48px;
      padding: 4px 16px;
      background: var(--mat-sys-inverse-surface);
      color: var(--mat-sys-inverse-on-surface);
      font: var(--mat-sys-body-medium);
    }
    .banner--error {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
    button {
      color: inherit;
    }
  `,
})
export class ConnectionBannerComponent {
  readonly status = input.required<ConnectionStatus>();
  readonly retry = output();
  readonly reload = output();

  protected readonly message = computed(() => {
    switch (this.status()) {
      case 'offline':
        return 'You are offline. Showing the last known data; ordering is paused.';
      case 'reconnecting':
        return 'Live updates interrupted. Reconnecting…';
      case 'error':
        return 'Live updates are unavailable. Reload the page to try again.';
      default:
        return null;
    }
  });
}
