import { MenuApiActions, MenuStreamActions } from './menu.actions';
import { applyMenuEvents, initialMenuState, menuFeature, type MenuState } from './menu.feature';
import {
  category,
  categoryRemoved,
  categoryUpserted,
  fixedItem,
  itemRemoved,
  itemUpserted,
  snapshot,
} from './testing/menu-fixtures';

const reducer = menuFeature.reducer;

function loaded(seq = 10): MenuState {
  return reducer(
    initialMenuState,
    MenuApiActions.snapshotLoaded({
      snapshot: snapshot(seq, [category('c1')], [fixedItem('a'), fixedItem('b', { version: 3 })]),
    }),
  );
}

describe('menu reducer', () => {
  it('tracks load status and errors', () => {
    const loading = reducer(initialMenuState, MenuApiActions.snapshotRequested());
    expect(loading.status).toBe('loading');

    const error = { code: 'INTERNAL' as const, message: 'Down', status: 500 };
    const failed = reducer(loading, MenuApiActions.snapshotFailed({ error }));
    expect(failed).toMatchObject({ status: 'error', error });
    expect(reducer(failed, MenuApiActions.snapshotRequested()).error).toBeNull();
  });

  it('replaces all data with a snapshot and records its seq', () => {
    const state = loaded(10);
    expect(state).toMatchObject({ status: 'loaded', snapshotSeq: 10, lastSeq: 10 });
    expect(state.items.ids).toEqual(['a', 'b']);

    const next = reducer(state, MenuApiActions.snapshotLoaded({ snapshot: snapshot(20, [], [fixedItem('z')]) }));
    expect(next.items.ids).toEqual(['z']);
    expect(next.categories.ids).toEqual([]);
  });

  it('applies newer upserts and removals in one action', () => {
    const next = reducer(
      loaded(10),
      MenuStreamActions.eventsApplied({
        events: [
          itemUpserted(11, fixedItem('a', { version: 2, available: false })),
          itemRemoved(12, 'b'),
          itemUpserted(13, fixedItem('c')),
          categoryUpserted(14, category('c2')),
        ],
      }),
    );
    expect(next.items.entities['a']).toMatchObject({ version: 2, available: false });
    expect(next.items.entities['b']).toBeUndefined();
    expect(next.items.entities['c']).toBeDefined();
    expect(next.categories.ids).toContain('c2');
    expect(next.lastSeq).toBe(14);
  });

  it('ignores upserts that are not newer than the stored version', () => {
    const next = applyMenuEvents(loaded(10), [itemUpserted(11, fixedItem('b', { version: 3, name: 'Stale' }))]);
    expect(next.items.entities['b']?.name).toBe('Item b');
    expect(next.lastSeq).toBe(11);
  });

  it('ignores events at or below the last applied seq', () => {
    const state = loaded(10);
    expect(applyMenuEvents(state, [itemRemoved(9, 'a'), itemRemoved(10, 'a')])).toBe(state);
  });

  it('applies events of one batch in order', () => {
    const next = applyMenuEvents(loaded(10), [
      itemUpserted(11, fixedItem('a', { version: 2 })),
      itemRemoved(12, 'a'),
      itemUpserted(13, fixedItem('a', { version: 5, name: 'Back' })),
      categoryRemoved(14, 'c1'),
    ]);
    expect(next.items.entities['a']).toMatchObject({ version: 5, name: 'Back' });
    expect(next.categories.ids).toEqual([]);
  });

  it('skips older duplicates inside a batch', () => {
    const next = applyMenuEvents(loaded(10), [
      itemUpserted(11, fixedItem('a', { version: 4, name: 'New' })),
      itemUpserted(12, fixedItem('a', { version: 3, name: 'Old' })),
    ]);
    expect(next.items.entities['a']?.name).toBe('New');
  });
});
