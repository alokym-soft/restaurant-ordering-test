import { TestBed } from '@angular/core/testing';
import { CategoryBarComponent } from './category-bar.component';

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
