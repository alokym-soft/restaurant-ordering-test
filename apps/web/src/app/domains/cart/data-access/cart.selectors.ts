import { createSelector } from '@ngrx/store';
import type { CreateOrderRequest, MenuChange, MenuItem, Minor } from '@restaurant/contracts';
import { selectItemEntities } from '@menu';
import { addMoney, multiplyMoney } from '@shared/util/money';
import { cartFeature, cartLineAdapter } from './cart.feature';
import type { CartLine } from './cart.models';
import { isCheckoutLocked } from './checkout.models';

export interface CartLineView {
  line: CartLine;
  lineTotal: Minor;
  /** What the server would report for this line right now, or `null` if it is fine. */
  issue: MenuChange | null;
  /** Current version of the menu item, `null` if it was removed. */
  currentItemVersion: number | null;
}

export interface CartTotals {
  subtotal: Minor;
  /** Discount as entered. */
  requestedDiscount: Minor;
  /** Discount actually applied: never more than the subtotal. */
  discount: Minor;
  total: Minor;
}

/**
 * Same rules as the server's checkout validation, applied live against the current menu,
 * so problems are visible before checkout.
 */
export function lineIssue(line: CartLine, item: MenuItem | undefined): MenuChange | null {
  if (!item) return { kind: 'removed', itemId: line.itemId };
  if (!item.available) return { kind: 'unavailable', itemId: item.id };
  const pricing = item.pricing;
  if (pricing.kind === 'fixed') {
    return line.unitPrice === pricing.price
      ? null
      : { kind: 'price_changed', itemId: item.id, previous: line.unitPrice, current: pricing.price };
  }
  return line.unitPrice < pricing.min || line.unitPrice > pricing.max
    ? { kind: 'open_price_out_of_range', itemId: item.id, min: pricing.min, max: pricing.max }
    : null;
}

const { selectAll } = cartLineAdapter.getSelectors();

export const selectCartLines = createSelector(cartFeature.selectLines, selectAll);

export const selectCartLineViews = createSelector(selectCartLines, selectItemEntities, (lines, items) =>
  lines.map((line): CartLineView => {
    const item = items[line.itemId];
    return {
      line,
      lineTotal: multiplyMoney(line.unitPrice, line.quantity),
      issue: lineIssue(line, item),
      currentItemVersion: item?.version ?? null,
    };
  }),
);

export const selectCartCount = createSelector(selectCartLines, (lines) =>
  lines.reduce((count, line) => count + line.quantity, 0),
);

export const selectCartIsEmpty = createSelector(selectCartLines, (lines) => lines.length === 0);

export const selectCartHasIssues = createSelector(selectCartLineViews, (views) => views.some((view) => view.issue));

export const selectCartTotals = createSelector(
  selectCartLineViews,
  cartFeature.selectDiscount,
  (views, requestedDiscount): CartTotals => {
    const subtotal = addMoney(...views.map((view) => view.lineTotal));
    const discount = Math.min(requestedDiscount, subtotal);
    return { subtotal, requestedDiscount, discount, total: subtotal - discount };
  },
);

export const selectCheckout = cartFeature.selectCheckout;

export const selectCheckoutStatus = createSelector(selectCheckout, (checkout) => checkout.status);

/** True while a request is in flight or its outcome is unknown; the cart cannot be edited. */
export const selectCartIsLocked = createSelector(selectCheckout, isCheckoutLocked);

/** Exactly what is sent; any change here must invalidate the idempotency key. */
export const selectOrderRequest = createSelector(
  selectCartLines,
  cartFeature.selectDiscount,
  (lines, discount): CreateOrderRequest => ({
    lines: lines.map(({ itemId, quantity, unitPrice, itemVersion }) => ({ itemId, quantity, unitPrice, itemVersion })),
    discount,
  }),
);
