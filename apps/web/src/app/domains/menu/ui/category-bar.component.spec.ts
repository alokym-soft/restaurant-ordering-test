import { TestBed } from '@angular/core/testing';
import { CategoryBarComponent, stepTarget } from './category-bar.component';

describe('CategoryBarComponent', () => {
  function setup(activeId: string | null = 'c2') {
    const fixture = TestBed.createComponent(CategoryBarComponent);
    fixture.componentRef.setInput('categories', [
      { id: 'c1', name: 'Soups' },
      { id: 'c2', name: 'Mains' },
    ]);
    fixture.componentRef.setInput('activeId', activeId);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    return { fixture, host, chips: Array.from(host.querySelectorAll<HTMLButtonElement>('.chip')) };
  }

  it('marks only the active chip with aria-current', () => {
    const { chips } = setup();
    expect(chips.map((chip) => chip.getAttribute('aria-current'))).toEqual([null, 'true']);
  });

  it('emits the category id on click', () => {
    const { fixture, chips } = setup();
    const emitted: string[] = [];
    fixture.componentInstance.selected.subscribe((id) => emitted.push(id));
    chips[0].click();
    expect(emitted).toEqual(['c1']);
  });

  it('hides edge buttons when nothing overflows', () => {
    const { host } = setup(null);
    expect(host.querySelector('[aria-label="Previous categories"]')).toBeNull();
    expect(host.querySelector('[aria-label="More categories"]')).toBeNull();
  });

  it('turns a vertical wheel into horizontal scroll when the bar overflows', () => {
    const { host } = setup(null);
    const scroller = host.querySelector<HTMLElement>('.scroller');
    if (!scroller) throw new Error('scroller missing');
    Object.defineProperty(scroller, 'scrollWidth', { value: 800 });
    Object.defineProperty(scroller, 'clientWidth', { value: 300 });
    const event = new WheelEvent('wheel', { deltaY: 120, cancelable: true });
    scroller.dispatchEvent(event);
    expect(scroller.scrollLeft).toBe(120);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('stepTarget', () => {
  // Chips 100 px wide, 8 px apart, starting at padding 4.
  const chips = Array.from({ length: 10 }, (_, i) => ({ left: 4 + i * 108, width: 100 }));

  it('forward: the first chip cut off on the right becomes the first visible chip', () => {
    // View 0..300 shows chips 0 and 1 fully; chip 2 (220..320) is cut off.
    expect(stepTarget(chips, 0, 300, 4, 1)).toBe(216);
  });

  it('back: the last chip cut off on the left becomes the last visible chip', () => {
    // View 216..516: chip 1 (112..212) is the last one hidden on the left.
    expect(stepTarget(chips, 216, 300, 4, -1)).toBe(0);
    expect(stepTarget(chips, 540, 300, 4, -1)).toBe(240);
  });

  it('returns null when nothing is hidden in that direction', () => {
    expect(stepTarget(chips, 0, 300, 4, -1)).toBeNull();
    expect(stepTarget(chips, 784, 300, 4, 1)).toBeNull();
  });
});