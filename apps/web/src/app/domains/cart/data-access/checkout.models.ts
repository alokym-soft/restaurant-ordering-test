import { InjectionToken } from '@angular/core';
import type { MenuChange } from '@restaurant/contracts';
import type { HttpApiError } from '@core/http';

/**
 * - `idle`: nothing in flight; the cart can be edited.
 * - `submitting`: a request is in flight; the cart is locked.
 * - `changes`: the menu differs from the cart; the user reviews the changes before submitting.
 * - `failed`: the outcome of the last attempt is unknown (network error, timeout, 5xx), so the order
 *   may exist. The cart is locked: only a retry with the same key, or an explicit unlock, is allowed.
 * - `done`: the order was placed and the cart was cleared.
 */
export type CheckoutStatus = 'idle' | 'submitting' | 'changes' | 'failed' | 'done';

export interface CheckoutState {
  status: CheckoutStatus;
  /**
   * `Idempotency-Key` for the current request body. Created on the first submit, kept for retries,
   * cleared whenever anything in the body changes (lines, quantities, prices, discount).
   */
  idempotencyKey: string | null;
  /** Changes reported by the last `409 MENU_CHANGED` or found before submitting. */
  lastChanges: MenuChange[];
  /** Error of the last attempt, shown to the user. */
  error: HttpApiError | null;
}

export const initialCheckoutState: CheckoutState = {
  status: 'idle',
  idempotencyKey: null,
  lastChanges: [],
  error: null,
};

/** While a request is in flight or its outcome is unknown, the request body must not change. */
export const isCheckoutLocked = (checkout: CheckoutState): boolean =>
  checkout.status === 'submitting' || checkout.status === 'failed';

/**
 * The request may have reached the server and created the order: nothing came back (status 0)
 * or the server failed (5xx), possibly after storing the order.
 */
export const isAmbiguousFailure = (error: HttpApiError): boolean => error.status === 0 || error.status >= 500;

/** Shown when the page was reloaded while an attempt was in flight or unresolved. */
export const UNCONFIRMED_ORDER_MESSAGE =
  'We could not confirm your last order. Retry to complete it safely, or check your orders.';

export const IDEMPOTENCY_KEY_FACTORY = new InjectionToken<() => string>('IDEMPOTENCY_KEY_FACTORY', {
  factory: () => () => crypto.randomUUID(),
});
