import { ChangeDetectionStrategy, Component, DOCUMENT, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Store } from '@ngrx/store';
import { ConnectionActions, connectionFeature } from '@core/realtime';
import { ConnectionBannerComponent } from './connection-banner.component';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatBadgeModule, ConnectionBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar class="toolbar">
      <a class="brand" routerLink="/menu">Restaurant</a>
      <nav class="nav" aria-label="Main">
        @for (link of links; track link.path) {
          <a mat-button [routerLink]="link.path" routerLinkActive="active" ariaCurrentWhenActive="page">
            {{ link.label }}
          </a>
        }
      </nav>
      <span class="spacer"></span>
      <a
        mat-button
        class="cart"
        routerLink="/cart"
        routerLinkActive="active"
        ariaCurrentWhenActive="page"
        [matBadge]="cartCount()"
        [matBadgeHidden]="cartCount() === 0"
        matBadgeOverlap="false"
        [attr.aria-label]="'Cart, ' + cartCount() + ' items'"
      >
        Cart
      </a>
    </mat-toolbar>
    <main class="content">
      <ng-content />
    </main>
    <app-connection-banner [status]="status()" (retry)="reconnect()" (reload)="reload()" />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100dvh;
    }
    .toolbar {
      flex: none;
      gap: 8px;
    }
    .brand {
      color: inherit;
      text-decoration: none;
      font: var(--mat-sys-title-large);
      margin-right: 16px;
    }
    .nav .active,
    .cart.active {
      background: var(--mat-sys-secondary-container);
    }
    .spacer {
      flex: 1;
    }
    .cart {
      margin-right: 16px;
    }
    .content {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
  `,
})
export class ShellComponent {
  private readonly store = inject(Store);
  private readonly document = inject(DOCUMENT);

  readonly cartCount = input(0);

  protected readonly status = this.store.selectSignal(connectionFeature.selectStatus);
  protected readonly links = [
    { path: '/menu', label: 'Menu' },
    { path: '/orders', label: 'Orders' },
    { path: '/setup', label: 'Setup' },
  ] as const;

  protected reconnect(): void {
    this.store.dispatch(ConnectionActions.reconnectRequested());
  }

  protected reload(): void {
    this.document.location.reload();
  }
}
