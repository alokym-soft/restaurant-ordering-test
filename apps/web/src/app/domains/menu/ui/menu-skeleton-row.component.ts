import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MENU_ROW_HEIGHT } from './menu-row-height';

/** Placeholder with the exact size of a menu item row, so loading causes no layout shift. */
@Component({
  selector: 'app-menu-skeleton-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.height.px]': 'rowHeight', 'aria-hidden': 'true' },
  template: `
    <div class="text">
      <span class="bar bar--name"></span>
      <span class="bar bar--meta"></span>
    </div>
    <span class="bar bar--price"></span>
    <span class="bar bar--add"></span>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      box-sizing: border-box;
      padding: 0 var(--space-4);
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bar {
      display: block;
      height: 12px;
      border-radius: 6px;
      background: var(--mat-sys-surface-container-high);
      animation: pulse 1.2s ease-in-out infinite;
    }
    .bar--name {
      width: 40%;
    }
    .bar--meta {
      width: 70%;
    }
    .bar--price {
      width: var(--menu-price-width);
    }
    @media (max-width: 600px) {
      :host {
        gap: var(--space-2);
        padding: 0 var(--space-3);
      }
      .bar--price {
        display: none;
      }
    }
    .bar--add {
      width: 196px;
      height: 36px;
      border-radius: 18px;
    }
    @keyframes pulse {
      50% {
        opacity: 0.5;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar {
        animation: none;
      }
    }
  `,
})
export class MenuSkeletonRowComponent {
  protected readonly rowHeight = MENU_ROW_HEIGHT;
}
