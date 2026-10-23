import { createEntityAdapter, type EntityState } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';
import type { Minor } from '@restaurant/contracts';
import { MenuPageActions } from '@menu';
import { CartPageActions } from './cart.actions';
import { type CartLine, cartLineId, clampQuantity } from './cart.models';

export interface CartState {
  lines: EntityState<CartLine>;
  /** Fixed discount as entered; clamped to the subtotal when totals are computed. */
  discount: Minor;
}

export const cartLineAdapter = createEntityAdapter<CartLine>();

export const initialCartState: CartState = {
  lines: cartLineAdapter.getInitialState(),
  discount: 0,
};

export const cartFeature = createFeature({
  name: 'cart',
  reducer: createReducer(
    initialCartState,
    on(MenuPageActions.itemAdded, (state, { itemId, name, priceKind, unitPrice, itemVersion, quantity }): CartState => {
      const id = cartLineId(itemId, priceKind, unitPrice);
      const existing = state.lines.entities[id];
      const line: CartLine = existing
        ? // Adding again means the user has seen the current name and price.
          { ...existing, name, unitPrice, itemVersion, quantity: clampQuantity(existing.quantity + quantity) }
        : { id, itemId, name, priceKind, unitPrice, itemVersion, quantity: clampQuantity(quantity) };
      return { ...state, lines: cartLineAdapter.upsertOne(line, state.lines) };
    }),
    on(CartPageActions.quantityChanged, (state, { lineId, quantity }): CartState => ({
      ...state,
      lines: cartLineAdapter.updateOne({ id: lineId, changes: { quantity: clampQuantity(quantity) } }, state.lines),
    })),
    on(CartPageActions.lineRemoved, (state, { lineId }): CartState => ({
      ...state,
      lines: cartLineAdapter.removeOne(lineId, state.lines),
    })),
    on(CartPageActions.discountChanged, (state, { discount }): CartState => ({
      ...state,
      discount: Math.max(0, Math.trunc(discount)),
    })),
    on(CartPageActions.priceAccepted, (state, { lineId, unitPrice, itemVersion }): CartState => ({
      ...state,
      lines: cartLineAdapter.updateOne({ id: lineId, changes: { unitPrice, itemVersion } }, state.lines),
    })),
  ),
});
