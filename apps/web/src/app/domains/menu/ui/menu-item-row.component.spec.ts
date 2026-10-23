import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { MenuItem } from '@restaurant/contracts';
import { type MenuItemAdd, MenuItemRowComponent } from './menu-item-row.component';

const item = (overrides: Partial<MenuItem> = {}): MenuItem => ({
  id: 'a',
  categoryId: 'c1',
  name: 'Soup',
  pricing: { kind: 'fixed', price: 12500 },
  available: true,
  sortOrder: 0,
  version: 1,
  ...overrides,
});

describe('MenuItemRowComponent', () => {
  let fixture: ComponentFixture<MenuItemRowComponent>;
  let added: MenuItemAdd[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [MenuItemRowComponent] }).compileComponents();
    fixture = TestBed.createComponent(MenuItemRowComponent);
    added = [];
    fixture.componentInstance.add.subscribe((event) => added.push(event));
  });

  async function show(value: MenuItem): Promise<HTMLElement> {
    fixture.componentRef.setInput('item', value);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  const button = (element: HTMLElement, label: string): HTMLButtonElement => {
    const found = Array.from(element.querySelectorAll('button')).find(
      (candidate) => candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label,
    );
    if (!found) throw new Error(`button ${label} not found`);
    return found;
  };

  it('shows a fixed price or the open-price prompt', async () => {
    let element = await show(item());
    expect(element.querySelector('.price')?.textContent).toContain('125,00');
    element = await show(item({ id: 'b', pricing: { kind: 'open', min: 0, max: 1000 } }));
    expect(element.querySelector('.price')?.textContent).toContain('Set your price');
  });

  it('emits the item with the chosen quantity', async () => {
    const element = await show(item());
    button(element, 'Increase quantity').click();
    button(element, 'Increase quantity').click();
    await fixture.whenStable();
    button(element, 'Add Soup to cart').click();
    expect(added).toEqual([{ item: item(), quantity: 3 }]);
  });

  it('resets the quantity when the row shows another item', async () => {
    const element = await show(item());
    button(element, 'Increase quantity').click();
    await fixture.whenStable();
    expect(element.querySelector('.quantity')?.textContent?.trim()).toBe('2');
    await show(item({ id: 'b', name: 'Tea' }));
    expect(element.querySelector('.quantity')?.textContent?.trim()).toBe('1');
  });

  it('keeps an unavailable item in place but disabled', async () => {
    const element = await show(item({ available: false }));
    expect(element.textContent).toContain('Unavailable');
    expect(button(element, 'Add Soup to cart').disabled).toBe(true);
  });
});
