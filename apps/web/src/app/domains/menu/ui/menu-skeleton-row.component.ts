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
      gap: 12px;
      box-sizing: border-box;
      padding: 0 16px;
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
      width: 150px;
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
