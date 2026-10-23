import { InjectionToken } from '@angular/core';
import type { ActionReducer, MetaReducer, StoreConfig } from '@ngrx/store';
import { isMinor } from '@shared/util/money';
import { type CartState, cartLineAdapter } from './cart.feature';
import { type CartLine, MAX_LINE_QUANTITY, cartLineId } from './cart.models';

export const CART_STORAGE_KEY = 'restaurant.cart';
const STORAGE_VERSION = 1;

export type CartStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface StoredCart {
  v: typeof STORAGE_VERSION;
  lines: CartLine[];
  discount: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function parseLine(value: unknown): CartLine | null {
  if (!isRecord(value)) return null;
  const { itemId, name, priceKind, unitPrice, itemVersion, quantity } = value;
  if (typeof itemId !== 'string' || itemId.length === 0) return null;
  if (typeof name !== 'string') return null;
  if (priceKind !== 'fixed' && priceKind !== 'open') return null;
  if (!isMinor(unitPrice) || unitPrice < 0) return null;
  if (!Number.isSafeInteger(itemVersion) || (itemVersion as number) < 1) return null;
  if (!Number.isSafeInteger(quantity) || (quantity as number) < 1 || (quantity as number) > MAX_LINE_QUANTITY) return null;
  return {
    // Derived again, so a tampered id cannot create duplicate lines.
    id: cartLineId(itemId, priceKind, unitPrice),
    itemId,
    name,
    priceKind,
    unitPrice,
    itemVersion: itemVersion as number,
    quantity: quantity as number,
  };
}

/**
 * Restores a saved cart. Anything unreadable is ignored: invalid lines are dropped individually,
 * an unknown format or broken JSON yields `null` (an empty cart).
 */
export function parseStoredCart(raw: string | null): Pick<CartState, 'lines' | 'discount'> | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || value['v'] !== STORAGE_VERSION || !Array.isArray(value['lines'])) return null;
  const lines = (value['lines'] as unknown[]).map(parseLine).filter((line): line is CartLine => line !== null);
  const discount = value['discount'];
  return {
    lines: cartLineAdapter.setAll(lines, cartLineAdapter.getInitialState()),
    discount: isMinor(discount) && discount >= 0 ? discount : 0,
  };
}

export function serializeCart(state: CartState): string {
  const stored: StoredCart = {
    v: STORAGE_VERSION,
    lines: cartLineAdapter.getSelectors().selectAll(state.lines),
    discount: state.discount,
  };
  return JSON.stringify(stored);
}

/** Restores the cart on first use and saves it whenever it changes. Storage failures are ignored. */
export function cartStorageMetaReducer(storage: CartStorage | null): MetaReducer<CartState> {
  return (reducer: ActionReducer<CartState>): ActionReducer<CartState> =>
    (state, action) => {
      if (state === undefined) {
        const initial = reducer(undefined, action);
        let restored: ReturnType<typeof parseStoredCart>;
        try {
          restored = parseStoredCart(storage?.getItem(CART_STORAGE_KEY) ?? null);
        } catch {
          restored = null;
        }
        return restored ? { ...initial, ...restored } : initial;
      }
      const next = reducer(state, action);
      if (next !== state && storage) {
        try {
          storage.setItem(CART_STORAGE_KEY, serializeCart(next));
        } catch {
          // Quota exceeded or storage disabled: the cart still works for this session.
        }
      }
      return next;
    };
}

function browserStorage(): CartStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export const CART_STORE_CONFIG = new InjectionToken<StoreConfig<CartState>>('CART_STORE_CONFIG', {
  factory: () => ({ metaReducers: [cartStorageMetaReducer(browserStorage())] }),
});
