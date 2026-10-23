import { createEntityAdapter, type EntityState } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';
import type { Minor } from '@restaurant/contracts';
import { MenuPageActions } from '@menu';
import { CartPageActions, CheckoutActions, CheckoutApiActions } from './cart.actions';
import { type CartLine, cartLineId, clampQuantity } from './cart.models';
import { type CheckoutState, initialCheckoutState, isAmbiguousFailure, isCheckoutLocked } from './checkout.models';

export interface CartState {
  lines: EntityState<CartLine>;
  /** Fixed discount as entered; clamped to the subtotal when totals are computed. */
  discount: Minor;
  checkout: CheckoutState;
}

export const cartLineAdapter = createEntityAdapter<CartLine>();

export const initialCartState: CartState = {
  lines: cartLineAdapter.getInitialState(),
  discount: 0,
  checkout: initialCheckoutState,
};

/**
 * Applies a change to the request body (lines or discount). Ignored while the cart is locked.
 * Any real change invalidates the idempotency key: the next submit is a different request.
 */
function editBody(state: CartState, change: (state: CartState) => CartState): CartState {
  if (isCheckoutLocked(state.checkout)) return state;
  const next = change(state);
  if (next.lines === state.lines && next.discount === state.discount) return state;
  return { ...next, checkout: { ...next.checkout, status: 'idle', idempotencyKey: null, error: null } };
}

export const cartFeature = createFeature({
  name: 'cart',
  reducer: createReducer(
    initialCartState,
    on(MenuPageActions.itemAdded, (state, { itemId, name, priceKind, unitPrice, itemVersion, quantity }) =>
      editBody(state, (s): CartState => {
        const id = cartLineId(itemId, priceKind, unitPrice);
        const existing = s.lines.entities[id];
        const line: CartLine = existing
          ? // Adding again means the user has seen the current name and price.
            { ...existing, name, unitPrice, itemVersion, quantity: clampQuantity(existing.quantity + quantity) }
          : { id, itemId, name, priceKind, unitPrice, itemVersion, quantity: clampQuantity(quantity) };
        return { ...s, lines: cartLineAdapter.upsertOne(line, s.lines) };
      }),
    ),
    on(CartPageActions.quantityChanged, (state, { lineId, quantity }) =>
      editBody(state, (s): CartState => {
        const line = s.lines.entities[lineId];
        const next = clampQuantity(quantity);
        if (!line || line.quantity === next) return s;
        return { ...s, lines: cartLineAdapter.updateOne({ id: lineId, changes: { quantity: next } }, s.lines) };
      }),
    ),
    on(CartPageActions.lineRemoved, (state, { lineId }) =>
      editBody(state, (s): CartState => ({ ...s, lines: cartLineAdapter.removeOne(lineId, s.lines) })),
    ),
    on(CartPageActions.discountChanged, (state, { discount }) =>
      editBody(state, (s): CartState => {
        const next = Math.max(0, Math.trunc(discount));
        return next === s.discount ? s : { ...s, discount: next };
      }),
    ),
    on(CartPageActions.priceAccepted, (state, { lineId, unitPrice, itemVersion }) =>
      editBody(state, (s): CartState => ({
        ...s,
        lines: cartLineAdapter.updateOne({ id: lineId, changes: { unitPrice, itemVersion } }, s.lines),
      })),
    ),
    on(CartPageActions.editUnlocked, (state): CartState =>
      state.checkout.status === 'failed'
        ? // The key is kept: an unchanged body is still the same request. The next edit clears it.
          { ...state, checkout: { ...state.checkout, status: 'idle', error: null } }
        : state,
    ),
    on(CheckoutActions.submitted, (state, { idempotencyKey }): CartState => ({
      ...state,
      checkout: { ...state.checkout, status: 'submitting', idempotencyKey, error: null },
    })),
    on(CheckoutApiActions.orderPlaced, (): CartState => ({
      ...initialCartState,
      checkout: { ...initialCheckoutState, status: 'done' },
    })),
    on(CheckoutApiActions.orderFailed, (state, { error }): CartState => ({
      ...state,
      checkout: isAmbiguousFailure(error)
        ? // The order may exist: keep the key so a retry cannot create a second one.
          { ...state.checkout, status: 'failed', error }
        : // The server rejected the request, so nothing was stored under this key.
          { ...state.checkout, status: 'idle', idempotencyKey: null, error },
    })),
  ),
});
