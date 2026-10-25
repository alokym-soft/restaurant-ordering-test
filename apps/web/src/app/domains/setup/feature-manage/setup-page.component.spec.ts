import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { Category, MenuItem } from '@restaurant/contracts';
import {
  SetupPageActions,
  itemKey,
  selectItemCountByCategory,
  selectPendingKeys,
  selectSetupCategories,
  selectSetupItemsByCategory,
} from '@setup/data-access';
import { SetupItemRowComponent } from '@setup/ui/setup-item-row.component';
import { SetupPageComponent } from '@setup/feature-manage/setup-page.component';

const item = (changes: Partial<MenuItem> = {}): MenuItem => ({
  id: 'i1',
  categoryId: 'c1',
  name: 'Soup',
  pricing: { kind: 'fixed', price: 1250 },
  available: true,
  sortOrder: 0,
  version: 3,
  ...changes,
});

describe('SetupItemRowComponent', () => {
  function render(pending = false, value = item()) {
    const fixture = TestBed.createComponent(SetupItemRowComponent);
    fixture.componentRef.setInput('item', value);
    fixture.componentRef.setInput('pending', pending);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const toggle = element.querySelector<HTMLButtonElement>('mat-slide-toggle button');
    return { fixture, element, toggle };
  }

  it('shows name, price and availability', () => {
    const { element, toggle } = render();
    expect(element.textContent).toContain('Soup');
    expect(element.textContent).toContain('$12.50');
    expect(toggle?.getAttribute('aria-checked')).toBe('true');
  });

  it('emits the new availability when toggled', () => {
    const { fixture, toggle } = render();
    const changes: boolean[] = [];
    fixture.componentInstance.availabilityChange.subscribe((value) => changes.push(value));
    toggle?.click();
    expect(changes).toEqual([false]);
  });

  it('while pending: shows "Saving…" and disables the toggle', () => {
    const { element, toggle, fixture } = render(true);
    const changes: boolean[] = [];
    fixture.componentInstance.availabilityChange.subscribe((value) => changes.push(value));

    expect(element.querySelector('.pending')?.textContent?.trim()).toBe('Saving…');
    expect(toggle?.disabled).toBe(true);
    toggle?.click();
    expect(changes).toEqual([]);
  });
});

describe('SetupPageComponent availability toggle', () => {
  const category: Category = { id: 'c1', name: 'Soups', sortOrder: 0, version: 1 };

  // jsdom has no layout; give the virtual scroll viewport a height so it renders rows.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  });

  async function setup(pending: ReadonlySet<string>) {
    TestBed.configureTestingModule({
      imports: [SetupPageComponent],
      providers: [provideRouter([]), provideMockStore()],
    });
    const store = TestBed.inject(MockStore);
    store.overrideSelector(selectSetupCategories, [category]);
    store.overrideSelector(selectSetupItemsByCategory, new Map([['c1', [item()]]]));
    store.overrideSelector(selectItemCountByCategory, new Map([['c1', 1]]));
    store.overrideSelector(selectPendingKeys, pending as ReturnType<typeof selectPendingKeys.projector>);
    const dispatch = vi.spyOn(store, 'dispatch');
    const fixture = TestBed.createComponent(SetupPageComponent);
    // The viewport measures itself after render and renders rows on a later frame.
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await new Promise((resolve) => setTimeout(resolve, 20));
      await fixture.whenStable();
    }
    return { fixture, dispatch, element: fixture.nativeElement as HTMLElement };
  }

  it('dispatches availabilityToggled with the item version', async () => {
    const { element, dispatch } = await setup(new Set());
    const toggle = element.querySelector<HTMLButtonElement>('[data-item-id="i1"] mat-slide-toggle button');
    expect(toggle).not.toBeNull();
    toggle?.click();
    expect(dispatch).toHaveBeenCalledWith(
      SetupPageActions.availabilityToggled({ id: 'i1', available: false, expectedVersion: 3 }),
    );
  });

  it('marks the row pending while its mutation is in flight', async () => {
    const { element } = await setup(new Set([itemKey('i1')]));
    const row = element.querySelector('[data-item-id="i1"]');
    expect(row?.querySelector('.pending')?.textContent?.trim()).toBe('Saving…');
    expect(row?.querySelector<HTMLButtonElement>('mat-slide-toggle button')?.disabled).toBe(true);
  });
});
