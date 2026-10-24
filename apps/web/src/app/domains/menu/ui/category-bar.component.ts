import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  afterRenderEffect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface CategoryBarEntry {
  id: string;
  name: string;
}

/** Fixed height of the bar; live chip updates never change it, so the list below does not jump. */
export const CATEGORY_BAR_HEIGHT = 56;

/**
 * Horizontally scrolling category chips. The native scrollbar is hidden; edge buttons appear only
 * when there is more content in that direction. Pure DOM behaviour, no store access.
 */
@Component({
  selector: 'app-category-bar',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      #scroller
      class="scroller"
      aria-label="Categories"
      (scroll)="updateEdges()"
      (wheel)="onWheel($event)"
      (focusin)="onFocusIn($event)"
    >
      @for (category of categories(); track category.id) {
        <button
          mat-stroked-button
          type="button"
          class="chip"
          [class.active]="category.id === activeId()"
          [attr.aria-current]="category.id === activeId() ? 'true' : null"
          [attr.data-category-id]="category.id"
          [title]="category.name"
          (click)="selected.emit(category.id)"
        >
          <span class="label truncate">{{ category.name }}</span>
        </button>
      }
    </nav>
    @if (canScrollBack()) {
      <div class="edge edge--start">
        <button mat-icon-button type="button" tabindex="-1" aria-label="Previous categories" (click)="page(-1)">
          <mat-icon>chevron_left</mat-icon>
        </button>
      </div>
    }
    @if (canScrollForward()) {
      <div class="edge edge--end">
        <button mat-icon-button type="button" tabindex="-1" aria-label="More categories" (click)="page(1)">
          <mat-icon>chevron_right</mat-icon>
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      flex: none;
      height: 56px;
    }
    .scroller {
      box-sizing: border-box;
      height: 100%;
      display: flex;
      align-items: center;
      gap: var(--space-2);
      /* Vertical padding leaves room for focus rings; overflow-y never scrolls. */
      padding: var(--space-2) var(--space-4);
      overflow-x: auto;
      overflow-y: hidden;
      overscroll-behavior-x: contain;
      scrollbar-width: none;
      white-space: nowrap;
    }
    .scroller::-webkit-scrollbar {
      display: none;
    }
    .chip {
      flex: none;
      max-width: 240px;
      height: 32px;
      padding: 0 var(--space-3);
    }
    /* The touch target is taller than the chip; keep it inside the bar. */
    .chip ::ng-deep .mat-mdc-button-touch-target {
      height: 40px;
    }
    .chip.active {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }
    .label {
      display: block;
    }
    .edge {
      position: absolute;
      top: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      width: 56px;
      pointer-events: none;
    }
    .edge button {
      pointer-events: auto;
    }
    .edge--start {
      left: 0;
      justify-content: flex-start;
      background: linear-gradient(to right, var(--mat-sys-surface) 50%, transparent);
    }
    .edge--end {
      right: 0;
      justify-content: flex-end;
      background: linear-gradient(to left, var(--mat-sys-surface) 50%, transparent);
    }
  `,
})
export class CategoryBarComponent {
  readonly categories = input.required<readonly CategoryBarEntry[]>();
  readonly activeId = input<string | null>(null);
  readonly selected = output<string>();

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly destroyRef = inject(DestroyRef);
  protected readonly canScrollBack = signal(false);
  protected readonly canScrollForward = signal(false);

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.updateEdges());
      observer.observe(this.scroller().nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
    afterRenderEffect(() => {
      this.categories();
      this.updateEdges();
    });
    afterRenderEffect(() => {
      const id = this.activeId();
      if (id === null) return;
      const chip = this.scroller().nativeElement.querySelector<HTMLElement>(
        `[data-category-id="${CSS.escape(id)}"]`,
      );
      if (chip) this.reveal(chip, true);
    });
  }

  protected updateEdges(): void {
    const el = this.scroller().nativeElement;
    const max = el.scrollWidth - el.clientWidth;
    // 1 px tolerance for fractional scroll positions at non-integer zoom levels.
    this.canScrollBack.set(el.scrollLeft > 1);
    this.canScrollForward.set(el.scrollLeft < max - 1);
  }

  /** A plain vertical wheel scrolls the bar sideways; trackpads and shift+wheel already do. */
  protected onWheel(event: WheelEvent): void {
    const el = this.scroller().nativeElement;
    if (event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    if (el.scrollWidth <= el.clientWidth) return;
    event.preventDefault();
    el.scrollLeft += event.deltaY;
  }

  protected onFocusIn(event: FocusEvent): void {
    if (event.target instanceof HTMLElement) this.reveal(event.target, false);
  }

  protected page(direction: -1 | 1): void {
    const el = this.scroller().nativeElement;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: this.behavior() });
  }

  private reveal(chip: HTMLElement, animate: boolean): void {
    if (typeof chip.scrollIntoView !== 'function') return;
    chip.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: animate ? this.behavior() : 'auto' });
  }

  private behavior(): ScrollBehavior {
    const reduced =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    return reduced ? 'auto' : 'smooth';
  }
}
