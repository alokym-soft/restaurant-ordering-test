import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
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

export interface ChipBox {
  left: number;
  width: number;
}

/**
 * Scroll position for one arrow step. Forward: the first chip cut off at the right edge becomes the
 * first fully visible chip. Back: the last chip cut off at the left edge becomes the last fully
 * visible chip. Returns null when there is nothing hidden in that direction.
 */
export function stepTarget(
  chips: readonly ChipBox[],
  scrollLeft: number,
  clientWidth: number,
  padding: number,
  direction: -1 | 1,
): number | null {
  const viewStart = scrollLeft + padding;
  const viewEnd = scrollLeft + clientWidth - padding;
  if (direction === 1) {
    const next = chips.find((chip) => chip.left + chip.width > viewEnd + 1);
    return next ? Math.max(0, next.left - padding) : null;
  }
  const previous = [...chips].reverse().find((chip) => chip.left < viewStart - 1);
  return previous ? Math.max(0, previous.left + previous.width + padding - clientWidth) : null;
}

/**
 * Horizontally scrolling category chips with a hidden native scrollbar. When the chips do not fit,
 * arrow buttons get their own columns at both ends (they never cover chips) and step chip by chip;
 * an arrow is disabled when there is nothing more in its direction. Pure DOM behaviour, no store.
 */
@Component({
  selector: 'app-category-bar',
  imports: [MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.overflowing]': 'overflowing()' },
  template: `
    @if (overflowing()) {
      <button
        mat-icon-button
        type="button"
        class="arrow"
        tabindex="-1"
        aria-label="Previous categories"
        [disabled]="!canScrollBack()"
        (click)="step(-1)"
      >
        <mat-icon>chevron_left</mat-icon>
      </button>
    }
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
    @if (overflowing()) {
      <button
        mat-icon-button
        type="button"
        class="arrow"
        tabindex="-1"
        aria-label="More categories"
        [disabled]="!canScrollForward()"
        (click)="step(1)"
      >
        <mat-icon>chevron_right</mat-icon>
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      flex: none;
      height: 56px;
      box-sizing: border-box;
    }
    :host(.overflowing) {
      padding: 0 var(--space-1);
    }
    .arrow {
      flex: none;
    }
    .scroller {
      position: relative;
      flex: 1;
      min-width: 0;
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
    :host(.overflowing) .scroller {
      padding: var(--space-2) var(--space-1);
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
  `,
})
export class CategoryBarComponent {
  readonly categories = input.required<readonly CategoryBarEntry[]>();
  readonly activeId = input<string | null>(null);
  readonly selected = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly destroyRef = inject(DestroyRef);
  protected readonly overflowing = signal(false);
  protected readonly canScrollBack = signal(false);
  protected readonly canScrollForward = signal(false);

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.updateEdges());
      observer.observe(this.host.nativeElement);
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
    const chips = this.chipBoxes();
    const last = chips.at(-1);
    // Content width is measured from the chips, not the scroller, so showing the arrows
    // (which narrows the scroller) cannot flip the result back and forth.
    const contentWidth = last ? last.left + last.width + this.padding() : 0;
    this.overflowing.set(contentWidth > this.host.nativeElement.clientWidth + 1);
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

  protected step(direction: -1 | 1): void {
    const el = this.scroller().nativeElement;
    const target = stepTarget(this.chipBoxes(), el.scrollLeft, el.clientWidth, this.padding(), direction);
    if (target !== null) el.scrollTo({ left: target, behavior: this.behavior() });
  }

  private chipBoxes(): ChipBox[] {
    return Array.from(this.scroller().nativeElement.querySelectorAll<HTMLElement>('.chip'), (chip) => ({
      left: chip.offsetLeft,
      width: chip.offsetWidth,
    }));
  }

  private padding(): number {
    return parseFloat(getComputedStyle(this.scroller().nativeElement).paddingLeft) || 0;
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
