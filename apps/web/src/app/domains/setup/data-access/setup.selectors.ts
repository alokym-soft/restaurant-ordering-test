import { createSelector } from '@ngrx/store';
import type { Category, CategoryId, MenuItem } from '@restaurant/contracts';
import { selectCategoryEntities, selectItemEntities } from '@menu';
import { setupFeature } from './setup.feature';
import type { Awaiting, MutationKey } from './setup.models';

type Entities<T> = Partial<Record<string, T>>;

/** True once the menu store reflects the saved change. */
export function isSettled(awaiting: Awaiting, categories: Entities<Category>, items: Entities<MenuItem>): boolean {
  const stored = awaiting.entity === 'category' ? categories[awaiting.id] : items[awaiting.id];
  return 'removed' in awaiting ? stored === undefined : stored !== undefined && stored.version >= awaiting.version;
}

/**
 * Keys of rows that are pending: a request is in flight, or it succeeded and the menu store has not
 * received the resulting event yet. Derived, so the event itself clears the pending state.
 */
export const selectPendingKeys = createSelector(
  setupFeature.selectInFlight,
  setupFeature.selectAwaiting,
  selectCategoryEntities,
  selectItemEntities,
  (inFlight, awaiting, categories, items): ReadonlySet<MutationKey> => {
    const keys = new Set(Object.keys(inFlight) as MutationKey[]);
    for (const [key, value] of Object.entries(awaiting) as [MutationKey, Awaiting][]) {
      if (!isSettled(value, categories, items)) keys.add(key);
    }
    return keys;
  },
);

export const selectMutationInFlight = (key: MutationKey) =>
  createSelector(setupFeature.selectInFlight, (inFlight) => inFlight[key] === true);

export const selectMutationError = (key: MutationKey) =>
  createSelector(setupFeature.selectErrors, (errors) => errors[key] ?? null);

const bySortOrder = <T extends { sortOrder: number; id: string }>(a: T, b: T): number =>
  a.sortOrder - b.sortOrder || a.id.localeCompare(b.id);

export const selectSetupCategories = createSelector(selectCategoryEntities, (entities): Category[] =>
  Object.values(entities)
    .filter((category): category is Category => category !== undefined)
    .sort(bySortOrder),
);

export const selectItemCountByCategory = createSelector(selectItemEntities, (entities) => {
  const counts = new Map<CategoryId, number>();
  for (const item of Object.values(entities)) {
    if (item) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
  }
  return counts;
});

export const selectSetupItemsByCategory = createSelector(selectItemEntities, (entities) => {
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
