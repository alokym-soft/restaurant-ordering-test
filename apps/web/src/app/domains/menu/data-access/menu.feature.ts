import { createEntityAdapter, type EntityState } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';
import type { Category, MenuEvent, MenuItem } from '@restaurant/contracts';
import type { HttpApiError } from '@core/http';
import { MenuApiActions, MenuStreamActions } from './menu.actions';

export type MenuLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface MenuState {
  categories: EntityState<Category>;
  items: EntityState<MenuItem>;
  /** `seq` of the last stored snapshot. */
  snapshotSeq: number | null;
  /** Highest `seq` applied (snapshot or event); older or repeated events are ignored. */
  lastSeq: number | null;
  status: MenuLoadStatus;
  error: HttpApiError | null;
}

export const categoryAdapter = createEntityAdapter<Category>();
export const itemAdapter = createEntityAdapter<MenuItem>();

export const initialMenuState: MenuState = {
  categories: categoryAdapter.getInitialState(),
  items: itemAdapter.getInitialState(),
  snapshotSeq: null,
  lastSeq: null,
  status: 'idle',
  error: null,
};

type Pending<T> = Map<string, T | null>;

function upsertIfNewer<T extends { id: string; version: number }>(
  pending: Pending<T>,
  stored: EntityState<T>,
  incoming: T,
): void {
  const current = pending.has(incoming.id) ? pending.get(incoming.id) : stored.entities[incoming.id];
  if (!current || current.version < incoming.version) pending.set(incoming.id, incoming);
}

function commit<T extends { id: string }>(
  adapter: ReturnType<typeof createEntityAdapter<T>>,
  state: EntityState<T>,
  pending: Pending<T>,
): EntityState<T> {
  if (pending.size === 0) return state;
  const upserts: T[] = [];
  const removals: string[] = [];
  for (const [id, entity] of pending) {
    if (entity) upserts.push(entity);
    else removals.push(id);
  }
  return adapter.removeMany(removals, adapter.upsertMany(upserts, state));
}

/**
 * Applies a batch of events in one pass. Events at or below `lastSeq` are skipped; an upsert
 * wins only if its `version` is newer than what is stored, so duplicates and reordering are harmless.
 */
export function applyMenuEvents(state: MenuState, events: readonly MenuEvent[]): MenuState {
  const categories: Pending<Category> = new Map();
  const items: Pending<MenuItem> = new Map();
  let lastSeq = state.lastSeq;

  for (const event of events) {
    if (lastSeq !== null && event.seq <= lastSeq) continue;
    lastSeq = event.seq;
    switch (event.type) {
      case 'menu.category.upserted':
        upsertIfNewer(categories, state.categories, event.payload);
        break;
      case 'menu.category.removed':
        categories.set(event.payload.id, null);
        break;
      case 'menu.item.upserted':
        upsertIfNewer(items, state.items, event.payload);
        break;
      case 'menu.item.removed':
        items.set(event.payload.id, null);
        break;
    }
  }

  if (lastSeq === state.lastSeq) return state;
  return {
    ...state,
    lastSeq,
    categories: commit(categoryAdapter, state.categories, categories),
    items: commit(itemAdapter, state.items, items),
  };
}

export const menuFeature = createFeature({
  name: 'menu',
  reducer: createReducer(
    initialMenuState,
    on(MenuApiActions.itemsRefreshed, (state, { items, removedIds }): MenuState => {
      const pending: Pending<MenuItem> = new Map();
      for (const item of items) upsertIfNewer(pending, state.items, item);
      for (const id of removedIds) if (state.items.entities[id]) pending.set(id, null);
      return pending.size === 0 ? state : { ...state, items: commit(itemAdapter, state.items, pending) };
    }),
    on(MenuApiActions.snapshotRequested, (state): MenuState => ({ ...state, status: 'loading', error: null })),
    on(
      MenuApiActions.snapshotLoaded,
      (state, { snapshot }): MenuState => ({
        ...state,
        categories: categoryAdapter.setAll(snapshot.categories, state.categories),
        items: itemAdapter.setAll(snapshot.items, state.items),
        snapshotSeq: snapshot.seq,
        lastSeq: snapshot.seq,
        status: 'loaded',
        error: null,
      }),
    ),
    on(MenuApiActions.snapshotFailed, (state, { error }): MenuState => ({ ...state, status: 'error', error })),
    on(MenuStreamActions.eventsApplied, (state, { events }) => applyMenuEvents(state, events)),
  ),
});
