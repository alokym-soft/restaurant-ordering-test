import type { ItemId, Minor } from '@restaurant/contracts';

export const MAX_LINE_QUANTITY = 99;

export type CartPriceKind = 'fixed' | 'open';

export interface CartLine {
  /** Fixed price: the item id. Open price: item id and price, so each entered price is its own line. */
  id: string;
  itemId: ItemId;
  /** Name when added; shown if the item is later removed from the menu. */
  name: string;
  priceKind: CartPriceKind;
  /** The price the user saw or entered; sent with the order and re-checked by the server. */
  unitPrice: Minor;
  itemVersion: number;
  quantity: number;
}

export function cartLineId(itemId: ItemId, priceKind: CartPriceKind, unitPrice: Minor): string {
  return priceKind === 'fixed' ? itemId : `${itemId}@${unitPrice}`;
}

export const clampQuantity = (quantity: number): number =>
  Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.trunc(quantity)));
