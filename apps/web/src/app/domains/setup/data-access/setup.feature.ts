import { createFeature, createReducer, on } from '@ngrx/store';
import type { HttpApiError } from '@core/http';
import { SetupApiActions, SetupPageActions, type SetupMutation } from './setup.actions';
import { type Awaiting, type MutationKey, NEW_CATEGORY_KEY, NEW_ITEM_KEY, categoryKey, itemKey } from './setup.models';

/** Mutation status only; the data itself is read from the menu store. */
export interface SetupState {
  inFlight: Partial<Record<MutationKey, true>>;
  /** Saved rows waiting for their event, keyed by the resulting entity. */
  awaiting: Partial<Record<MutationKey, Awaiting>>;
  errors: Partial<Record<MutationKey, HttpApiError>>;
}

export const initialSetupState: SetupState = { inFlight: {}, awaiting: {}, errors: {} };

export function mutationKey(action: SetupMutation): MutationKey {
  switch (action.type) {
    case SetupPageActions.categoryCreated.type:
      return NEW_CATEGORY_KEY;
    case SetupPageActions.categoryUpdated.type:
    case SetupPageActions.categoryDeleteConfirmed.type:
      return categoryKey(action.id);
    case SetupPageActions.itemCreated.type:
      return NEW_ITEM_KEY;
    case SetupPageActions.itemUpdated.type:
    case SetupPageActions.availabilityToggled.type:
    case SetupPageActions.itemDeleteConfirmed.type:
      return itemKey(action.id);
  }
}

export const awaitingKey = (awaiting: Awaiting): MutationKey => `${awaiting.entity}:${awaiting.id}`;

function without<K extends string, V>(record: Partial<Record<K, V>>, key: K): Partial<Record<K, V>> {
  if (!(key in record)) return record;
  const copy = { ...record };
  delete copy[key];
  return copy;
}

export const setupFeature = createFeature({
  name: 'setup',
  reducer: createReducer(
    initialSetupState,
    on(
      SetupPageActions.categoryCreated,
      SetupPageActions.categoryUpdated,
      SetupPageActions.categoryDeleteConfirmed,
      SetupPageActions.itemCreated,
      SetupPageActions.itemUpdated,
      SetupPageActions.availabilityToggled,
      SetupPageActions.itemDeleteConfirmed,
      (state, action): SetupState => {
        const key = mutationKey(action);
        return { ...state, inFlight: { ...state.inFlight, [key]: true }, errors: without(state.errors, key) };
      },
    ),
    on(SetupApiActions.mutationSucceeded, (state, { key, awaiting }): SetupState => ({
      ...state,
      inFlight: without(state.inFlight, key),
      awaiting: { ...state.awaiting, [awaitingKey(awaiting)]: awaiting },
    })),
    on(SetupApiActions.mutationFailed, (state, { key, error }): SetupState => ({
      ...state,
      inFlight: without(state.inFlight, key),
      errors: { ...state.errors, [key]: error },
    })),
  ),
});
