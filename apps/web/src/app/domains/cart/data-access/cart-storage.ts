import { InjectionToken } from '@angular/core';
import type { ActionReducer, MetaReducer, StoreConfig } from '@ngrx/store';
import { isMinor } from '@shared/util/money';
import { type CartState, cartLineAdapter } from './cart.feature';
import { type CartLine, MAX_LINE_QUANTITY, cartLineId } from './cart.models';
import {
  type CheckoutState,
  UNCONFIRMED_ORDER_MESSAGE,
  initialCheckoutState,
  isCheckoutLocked,
} from './checkout.models';

export const CART_STORAGE_KEY = 'restaurant.cart';
const STORAGE_VERSION = 1;

export type CartStorage = Pick<Storage, 'getItem' | 'setItem'>;

interface StoredCart {
  v: typeof STORAGE_VERSION;
  lines: CartLine[];
  discount: number;
  /**
   * Key of an attempt whose outcome is unknown (in flight or failed ambiguously). Restored as a
   * locked `failed` checkout, so a reload cannot turn a retry into a second order.
   */
  pendingKey?: string;
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
export function parseStoredCart(raw: string | null): CartState | null {
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
  const pendingKey = value['pendingKey'];
  const checkout: CheckoutState =
    typeof pendingKey === 'string' && pendingKey.length > 0 && lines.length > 0
      ? {
          ...initialCheckoutState,
          status: 'failed',
          idempotencyKey: pendingKey,
          error: { code: 'INTERNAL', message: UNCONFIRMED_ORDER_MESSAGE, status: 0 },
        }
      : initialCheckoutState;
  return {
    lines: cartLineAdapter.setAll(lines, cartLineAdapter.getInitialState()),
    discount: isMinor(discount) && discount >= 0 ? discount : 0,
    checkout,
  };
}

export function serializeCart(state: CartState): string {
  const stored: StoredCart = {
    v: STORAGE_VERSION,
    lines: cartLineAdapter.getSelectors().selectAll(state.lines),
    discount: state.discount,
  };
  if (isCheckoutLocked(state.checkout) && state.checkout.idempotencyKey) {
    stored.pendingKey = state.checkout.idempotencyKey;
  }
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
