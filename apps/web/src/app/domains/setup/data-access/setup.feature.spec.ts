import { MenuApiActions, initialMenuState, menuFeature, MenuStreamActions } from '@menu';
import type { HttpApiError } from '@core/http';
import type { Category, MenuItem } from '@restaurant/contracts';
import { SetupApiActions, SetupPageActions } from './setup.actions';
import { initialSetupState, setupFeature } from './setup.feature';
import { NEW_ITEM_KEY, itemKey } from './setup.models';
import { selectPendingKeys } from './setup.selectors';

const item = (version: number): MenuItem => ({
  id: 'i1',
  categoryId: 'c1',
  name: 'Soup',
  pricing: { kind: 'fixed', price: 1000 },
  available: true,
  sortOrder: 0,
  version,
});
const category: Category = { id: 'c1', name: 'Soups', sortOrder: 0, version: 1 };

const menuWith = (...items: MenuItem[]) =>
  menuFeature.reducer(
    initialMenuState,
    MenuApiActions.snapshotLoaded({ snapshot: { seq: 1, categories: [category], items } }),
  );

const pending = (setup: typeof initialSetupState, menu: ReturnType<typeof menuWith>) =>
  selectPendingKeys({ setup, menu });

describe('setup mutation state', () => {
  const toggled = SetupPageActions.availabilityToggled({ id: 'i1', available: false, expectedVersion: 1 });

  it('keeps a row pending from the request until the menu receives the saved version', () => {
    const inFlight = setupFeature.reducer(initialSetupState, toggled);
    expect(pending(inFlight, menuWith(item(1))).has(itemKey('i1'))).toBe(true);

    const saved = setupFeature.reducer(
      inFlight,
      SetupApiActions.mutationSucceeded({ key: itemKey('i1'), awaiting: { entity: 'item', id: 'i1', version: 2 } }),
    );
    expect(saved.inFlight).toEqual({});
    // The response alone does not settle the row: the menu still has version 1.
    expect(pending(saved, menuWith(item(1))).has(itemKey('i1'))).toBe(true);

    const menuUpdated = menuFeature.reducer(
      menuWith(item(1)),
      MenuStreamActions.eventsApplied({
        events: [{ seq: 2, at: '', type: 'menu.item.upserted', payload: item(2) }],
      }),
    );
    expect(pending(saved, menuUpdated).size).toBe(0);
  });

  it('keeps a deleted row pending until it disappears from the menu', () => {
    const saved = setupFeature.reducer(
      initialSetupState,
      SetupApiActions.mutationSucceeded({ key: itemKey('i1'), awaiting: { entity: 'item', id: 'i1', removed: true } }),
    );
    expect(pending(saved, menuWith(item(1))).has(itemKey('i1'))).toBe(true);
    expect(pending(saved, menuWith()).size).toBe(0);
  });

  it('stores the error of a failed mutation and clears it on the next attempt', () => {
    const error: HttpApiError = { code: 'VERSION_CONFLICT', message: 'Changed', status: 409 };
    const failed = setupFeature.reducer(
      setupFeature.reducer(initialSetupState, toggled),
      SetupApiActions.mutationFailed({ key: itemKey('i1'), error }),
    );
    expect(failed.inFlight).toEqual({});
    expect(failed.errors[itemKey('i1')]).toEqual(error);
    expect(setupFeature.reducer(failed, toggled).errors).toEqual({});
  });

  it('tracks creates under a shared key', () => {
    const state = setupFeature.reducer(
      initialSetupState,
      SetupPageActions.itemCreated({
        request: { categoryId: 'c1', name: 'Tea', pricing: { kind: 'fixed', price: 500 } },
      }),
    );
    expect(state.inFlight[NEW_ITEM_KEY]).toBe(true);
  });
});
