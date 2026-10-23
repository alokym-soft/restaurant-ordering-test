import type { Category, CategoryId, ItemId, MenuItem, MenuSnapshot } from '@restaurant/contracts';

const bySortOrder = <T extends { sortOrder: number; id: string }>(a: T, b: T): number =>
  a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);

/** Menu state. Every mutation bumps the entity `version`. */
export class MenuStore {
  readonly categories = new Map<CategoryId, Category>();
  readonly items = new Map<ItemId, MenuItem>();

  constructor(private readonly currentSeq: () => number) {}

  load(categories: readonly Category[], items: readonly MenuItem[]): void {
    this.categories.clear();
    this.items.clear();
    for (const category of categories) this.categories.set(category.id, category);
    for (const item of items) this.items.set(item.id, item);
  }

  snapshot(): MenuSnapshot {
    return {
      seq: this.currentSeq(),
      categories: [...this.categories.values()].sort(bySortOrder),
      items: [...this.items.values()].sort(
        (a, b) => a.categoryId.localeCompare(b.categoryId) || bySortOrder(a, b),
      ),
    };
  }

  getItem(id: ItemId): MenuItem | undefined {
    return this.items.get(id);
  }
}
