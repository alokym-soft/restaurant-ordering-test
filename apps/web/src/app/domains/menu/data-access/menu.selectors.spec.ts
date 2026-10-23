import { MenuApiActions, MenuStreamActions } from './menu.actions';
import { initialMenuState, menuFeature, type MenuState } from './menu.feature';
import {
  selectCategoryNav,
  selectMenuIsEmptyLoading,
  selectMenuItemById,
  selectMenuRows,
  selectOrderedCategories,
} from './menu.selectors';
import { category, fixedItem, itemUpserted, snapshot } from './testing/menu-fixtures';

const reducer = menuFeature.reducer;
const root = (menu: MenuState) => ({ menu });

function state(): MenuState {
  return reducer(
    initialMenuState,
    MenuApiActions.snapshotLoaded({
      snapshot: snapshot(
        1,
        [category('c2', { sortOrder: 2, name: 'Drinks' }), category('c1', { sortOrder: 1, name: 'Food' }), category('c3', { sortOrder: 3 })],
        [
          fixedItem('i2', { categoryId: 'c1', sortOrder: 2 }),
          fixedItem('i1', { categoryId: 'c1', sortOrder: 1 }),
          fixedItem('i3', { categoryId: 'c2', sortOrder: 1 }),
        ],
      ),
    }),
  );
}

describe('menu selectors', () => {
  it('orders categories by sortOrder', () => {
    expect(selectOrderedCategories(root(state())).map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('builds flat rows with headers, skipping empty categories', () => {
    expect(selectMenuRows(root(state()))).toEqual([
      { kind: 'category', id: 'c1', name: 'Food' },
      { kind: 'item', id: 'i1' },
      { kind: 'item', id: 'i2' },
      { kind: 'category', id: 'c2', name: 'Drinks' },
      { kind: 'item', id: 'i3' },
    ]);
  });

  it('keeps the rows reference when only item details change', () => {
    const before = state();
    const rows = selectMenuRows(root(before));
    const after = reducer(
      before,
      MenuStreamActions.eventsApplied({
        events: [itemUpserted(2, fixedItem('i1', { categoryId: 'c1', sortOrder: 1, version: 2, available: false }))],
      }),
    );
    expect(selectMenuRows(root(after))).toBe(rows);
    expect(selectMenuItemById('i1')(root(after))?.available).toBe(false);
  });

  it('rebuilds rows when order changes', () => {
    const before = state();
    const rows = selectMenuRows(root(before));
    const after = reducer(
      before,
      MenuStreamActions.eventsApplied({
        events: [itemUpserted(2, fixedItem('i1', { categoryId: 'c1', sortOrder: 9, version: 2 }))],
      }),
    );
    const next = selectMenuRows(root(after));
    expect(next).not.toBe(rows);
    expect(next.slice(1, 3).map((row) => row.id)).toEqual(['i2', 'i1']);
  });

  it('indexes category headers for navigation', () => {
    expect(selectCategoryNav(root(state()))).toEqual([
      { id: 'c1', name: 'Food', rowIndex: 0 },
      { id: 'c2', name: 'Drinks', rowIndex: 3 },
    ]);
  });

  it('reports the empty loading state only while there is nothing to show', () => {
    expect(selectMenuIsEmptyLoading(root(initialMenuState))).toBe(true);
    const refreshing = reducer(state(), MenuApiActions.snapshotRequested());
    expect(selectMenuIsEmptyLoading(root(refreshing))).toBe(false);
  });
});
