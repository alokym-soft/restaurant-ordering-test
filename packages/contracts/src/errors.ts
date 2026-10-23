import type { ItemId, MenuItem } from './menu';
import type { Minor } from './money';

export type ApiErrorCode =
  | 'VALIDATION_FAILED'     // 400
  | 'NOT_FOUND'             // 404
  | 'VERSION_CONFLICT'      // 409, Setup edit on a stale entity
  | 'CATEGORY_NOT_EMPTY'    // 409, deleting a category that still has items
  | 'MENU_CHANGED'          // 409, checkout saw outdated prices or availability
  | 'IDEMPOTENCY_MISMATCH'  // 422, same key reused with a different body
  | 'INTERNAL';             // 500

/** Every non-2xx response has this shape. */
export interface ApiError<C extends ApiErrorCode = ApiErrorCode, D = unknown> {
  code: C;
  /** Safe to show to the user as-is. */
  message: string;
  details?: D;
}

export type MenuChange =
  | { kind: 'price_changed'; itemId: ItemId; previous: Minor; current: Minor }
  | { kind: 'unavailable'; itemId: ItemId }
  | { kind: 'removed'; itemId: ItemId }
  | { kind: 'open_price_out_of_range'; itemId: ItemId; min: Minor; max: Minor };

export type MenuChangedError = ApiError<
  'MENU_CHANGED',
  { changes: MenuChange[]; items: MenuItem[] }
>;

export type VersionConflictError<T> = ApiError<'VERSION_CONFLICT', { current: T }>;

export interface FieldError {
  field: string;
  message: string;
}

export type ValidationError = ApiError<'VALIDATION_FAILED', { fields: FieldError[] }>;
