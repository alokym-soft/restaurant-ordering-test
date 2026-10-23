import type { Minor } from './money';

export type CategoryId = string;
export type ItemId = string;

export interface Category {
  id: CategoryId;
  name: string;
  sortOrder: number;
  /** Incremented on every change; used for optimistic concurrency in Setup. */
  version: number;
}

/** Fixed price is set in Setup; open price is entered when adding to the cart. */
export type Pricing =
  | { kind: 'fixed'; price: Minor }
  | { kind: 'open'; min: Minor; max: Minor };

export interface MenuItem {
  id: ItemId;
  categoryId: CategoryId;
  name: string;
  description?: string;
  pricing: Pricing;
  available: boolean;
  sortOrder: number;
  version: number;
}

/** Full menu state as of a given event sequence number. */
export interface MenuSnapshot {
  seq: number;
  categories: Category[];
  items: MenuItem[];
}
