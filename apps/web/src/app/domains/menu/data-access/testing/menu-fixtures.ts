import type { Category, MenuEvent, MenuItem, MenuSnapshot } from '@restaurant/contracts';

export function category(id: string, overrides: Partial<Category> = {}): Category {
  return { id, name: `Category ${id}`, sortOrder: 0, version: 1, ...overrides };
}

export function fixedItem(id: string, overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id,
    categoryId: 'c1',
    name: `Item ${id}`,
    pricing: { kind: 'fixed', price: 1000 },
    available: true,
    sortOrder: 0,
    version: 1,
    ...overrides,
  };
}

export function openItem(id: string, min = 500, max = 5000, overrides: Partial<MenuItem> = {}): MenuItem {
  return fixedItem(id, { pricing: { kind: 'open', min, max }, ...overrides });
}

export function snapshot(seq: number, categories: Category[], items: MenuItem[]): MenuSnapshot {
  return { seq, categories, items };
}

const at = '2026-10-23T12:00:00.000Z';

export const itemUpserted = (seq: number, item: MenuItem): MenuEvent => ({
  seq,
  at,
  type: 'menu.item.upserted',
  payload: item,
});

export const itemRemoved = (seq: number, id: string): MenuEvent => ({ seq, at, type: 'menu.item.removed', payload: { id } });

export const categoryUpserted = (seq: number, value: Category): MenuEvent => ({
  seq,
  at,
  type: 'menu.category.upserted',
  payload: value,
});

export const categoryRemoved = (seq: number, id: string): MenuEvent => ({
  seq,
  at,
  type: 'menu.category.removed',
  payload: { id },
});
