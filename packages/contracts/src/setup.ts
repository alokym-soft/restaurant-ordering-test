import type { CategoryId, Pricing } from './menu';

export interface CreateCategoryRequest {
  name: string;
  sortOrder?: number;
}

export interface UpdateCategoryRequest {
  name?: string;
  sortOrder?: number;
  /** Rejected with VERSION_CONFLICT if the category changed meanwhile. */
  expectedVersion: number;
}

export interface CreateItemRequest {
  categoryId: CategoryId;
  name: string;
  description?: string;
  pricing: Pricing;
  available?: boolean;
  sortOrder?: number;
}

export interface UpdateItemRequest {
  categoryId?: CategoryId;
  name?: string;
  description?: string;
  pricing?: Pricing;
  available?: boolean;
  sortOrder?: number;
  expectedVersion: number;
}

/**
 * Setup mutations respond with the updated entity, but the Menu store is
 * updated only from the event stream: one source of truth for every client.
 */
