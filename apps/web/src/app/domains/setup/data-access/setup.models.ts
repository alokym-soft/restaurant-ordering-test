import type { CategoryId, ItemId } from '@restaurant/contracts';

export type SetupEntity = 'category' | 'item';

/** Identifies one row's mutations: `category:<id>`, `item:<id>`, or `<entity>:new` for creates. */
export type MutationKey = `${SetupEntity}:${string}`;

export const categoryKey = (id: CategoryId): MutationKey => `category:${id}`;
export const itemKey = (id: ItemId): MutationKey => `item:${id}`;
export const NEW_CATEGORY_KEY: MutationKey = 'category:new';
export const NEW_ITEM_KEY: MutationKey = 'item:new';

export const VERSION_CONFLICT_MESSAGE = 'Changed by someone else, showing the latest version';

/**
 * What the menu store must show before a saved row stops being pending: the version the server
 * returned, or the entity gone after a delete. The menu changes only from events, never from responses.
 */
export type Awaiting =
  | { entity: SetupEntity; id: string; version: number }
  | { entity: SetupEntity; id: string; removed: true };
