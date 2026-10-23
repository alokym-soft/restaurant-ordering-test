import { createSelector, createSelectorFactory, resultMemoize, type MemoizedSelector } from '@ngrx/store';
import type { Category, CategoryId, ItemId, MenuItem } from '@restaurant/contracts';
import { menuFeature } from './menu.feature';

export type MenuRow =
  | { kind: 'category'; id: CategoryId; name: string }
  | { kind: 'item'; id: ItemId };

export interface CategoryNavEntry {
  id: CategoryId;
  name: string;
  /** Index of the category header in {@link selectMenuRows}. */
  rowIndex: number;
}

const bySortOrder = <T extends { sortOrder: number; id: string }>(a: T, b: T): number =>
  a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);

const isDefined = <T>(value: T | undefined): value is T => value !== undefined;

function sameRows(a: readonly MenuRow[], b: readonly MenuRow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, index) => {
    const other = b[index];
    if (!other || other.kind !== row.kind || other.id !== row.id) return false;
    return row.kind !== 'category' || (other.kind === 'category' && other.name === row.name);
  });
}

/**
 * A selector whose result keeps its reference while the rows are equal, so price or availability
 * changes do not rebuild the virtual scroll list; only the affected row re-renders.
 */
const createRowsSelector = createSelectorFactory((projector) =>
  resultMemoize(projector, (a: MenuRow[], b: MenuRow[]) => sameRows(a, b)),
);

export const selectCategoryEntities = createSelector(menuFeature.selectCategories, (state) => state.entities);
export const selectItemEntities = createSelector(menuFeature.selectItems, (state) => state.entities);

export const selectOrderedCategories = createSelector(selectCategoryEntities, (entities): Category[] =>
  Object.values(entities).filter(isDefined).sort(bySortOrder),
);

const selectItemsByCategory = createSelector(selectItemEntities, (entities) => {
  const groups = new Map<CategoryId, MenuItem[]>();
  for (const item of Object.values(entities)) {
    if (!item) continue;
    const group = groups.get(item.categoryId);
    if (group) group.push(item);
    else groups.set(item.categoryId, [item]);
  }
  for (const group of groups.values()) group.sort(bySortOrder);
  return groups;
});

/** Flat list for the virtual scroll: a header row per category followed by its item ids. */
export const selectMenuRows: MemoizedSelector<object, MenuRow[]> = createRowsSelector(
  selectOrderedCategories,
  selectItemsByCategory,
  (categories: Category[], groups: Map<CategoryId, MenuItem[]>): MenuRow[] => {
    const rows: MenuRow[] = [];
    for (const category of categories) {
      const items = groups.get(category.id);
      if (!items?.length) continue;
      rows.push({ kind: 'category', id: category.id, name: category.name });
      for (const item of items) rows.push({ kind: 'item', id: item.id });
    }
    return rows;
  },
);

export const selectCategoryNav = createSelector(selectMenuRows, (rows): CategoryNavEntry[] =>
  rows.flatMap((row, rowIndex) => (row.kind === 'category' ? [{ id: row.id, name: row.name, rowIndex }] : [])),
);

export const selectMenuItemById = (id: ItemId) => createSelector(selectItemEntities, (entities) => entities[id]);

/** True when there is nothing to show yet; a refresh over existing data keeps the list visible. */
export const selectMenuIsEmptyLoading = createSelector(
  menuFeature.selectStatus,
  selectMenuRows,
  (status, rows) => (status === 'idle' || status === 'loading') && rows.length === 0,
);
