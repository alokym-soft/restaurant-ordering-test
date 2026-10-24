import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import type { Category, MenuItem } from '@restaurant/contracts';
import { type ItemFormSave, ItemFormComponent, pricingValidator } from './item-form.component';

const categories: Category[] = [{ id: 'c1', name: 'Soups', sortOrder: 0, version: 1 }];
const soup = (version: number, name = 'Soup'): MenuItem => ({
  id: 'i1',
  categoryId: 'c1',
  name,
  pricing: { kind: 'fixed', price: 1000 },
  available: true,
  sortOrder: 0,
  version,
});

function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Element not found');
  return value;
}

async function render(item: MenuItem | null) {
  await TestBed.configureTestingModule({ imports: [ItemFormComponent] }).compileComponents();
  const fixture = TestBed.createComponent(ItemFormComponent);
  fixture.componentRef.setInput('categories', categories);
  fixture.componentRef.setInput('item', item);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const nameInput = () => must(element.querySelector<HTMLInputElement>('input[formcontrolname="name"]'));
  const saves: ItemFormSave[] = [];
  fixture.componentInstance.save.subscribe((save) => saves.push(save));
  const type = async (value: string) => {
    nameInput().value = value;
    nameInput().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const setItem = async (next: MenuItem) => {
    fixture.componentRef.setInput('item', next);
    await fixture.whenStable();
  };
  const submit = async () => {
    must(element.querySelector('form')).dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  const notice = () => element.querySelector('.notice');
  return { element, nameInput, saves, type, setItem, submit, notice };
}

describe('ItemFormComponent', () => {
  it('silently loads a newer version while pristine', async () => {
    const view = await render(soup(1));
    await view.setItem(soup(2, 'Borscht'));
    expect(view.nameInput().value).toBe('Borscht');
    expect(view.notice()).toBeNull();
    await view.submit();
    expect(view.saves[0]?.expectedVersion).toBe(2);
  });

  it('keeps edits and offers the latest version when dirty', async () => {
    const view = await render(soup(1));
    await view.type('My soup');
    await view.setItem(soup(2, 'Borscht'));
    expect(view.nameInput().value).toBe('My soup');
    expect(view.notice()?.textContent).toContain('This item was changed elsewhere');

    // Saving now sends the version the edits were based on, so the server reports a conflict.
    await view.submit();
    expect(view.saves[0]).toMatchObject({ value: { name: 'My soup' }, expectedVersion: 1 });

    must(view.notice()?.querySelector('button')).click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(view.nameInput().value).toBe('Borscht');
    expect(view.notice()).toBeNull();
    await view.submit();
    expect(view.saves[1]?.expectedVersion).toBe(2);
  });

  it('does not save an incomplete new item', async () => {
    const view = await render(null);
    await view.type('Tea');
    await view.submit();
    expect(view.saves).toEqual([]); // no category or price yet
  });
});

describe('pricingValidator', () => {
  const group = (value: Record<string, string>) =>
    new FormGroup({
      pricingKind: new FormControl(value['pricingKind']),
      price: new FormControl(value['price'] ?? ''),
      min: new FormControl(value['min'] ?? ''),
      max: new FormControl(value['max'] ?? ''),
    });

  it('requires a valid fixed price', () => {
    expect(pricingValidator(group({ pricingKind: 'fixed', price: '120.50' }))).toBeNull();
    expect(pricingValidator(group({ pricingKind: 'fixed', price: 'abc' }))).toEqual({ price: true });
  });

  it('requires valid open limits with min not above max', () => {
    expect(pricingValidator(group({ pricingKind: 'open', min: '0', max: '100' }))).toBeNull();
    expect(pricingValidator(group({ pricingKind: 'open', min: '50', max: '' }))).toEqual({ range: true });
    expect(pricingValidator(group({ pricingKind: 'open', min: '0', max: '0' }))).toEqual({ range: true });
    expect(pricingValidator(group({ pricingKind: 'open', min: '200', max: '100' }))).toEqual({ order: true });
  });
});
