import type { ItemId } from './menu';
import type { Minor } from './money';

export type OrderId = string;

export type OrderStatus = 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';

/** What the client believes it is buying. The server re-validates every line. */
export interface OrderLineRequest {
  itemId: ItemId;
  quantity: number;
  /** For fixed price: the price shown to the user. For open price: the entered price. */
  unitPrice: Minor;
  /**
   * Accepted for diagnostics; the server validates lines by value
   * (price, pricing range and availability), not by version.
   */
  itemVersion: number;
}

/**
 * POST /api/orders. Requires the `Idempotency-Key` header (UUID generated
 * when checkout starts, regenerated only if the cart contents change).
 */
export interface CreateOrderRequest {
  lines: OrderLineRequest[];
  /** Fixed-amount discount; the server clamps it to the subtotal. */
  discount: Minor;
}

export interface OrderLine {
  itemId: ItemId;
  /** Snapshot of the name at order time, so later menu edits don't rewrite history. */
  name: string;
  unitPrice: Minor;
  quantity: number;
  lineTotal: Minor;
}

export interface Order {
  id: OrderId;
  /** Human-friendly number shown in the UI. */
  number: number;
  lines: OrderLine[];
  subtotal: Minor;
  discount: Minor;
  total: Minor;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface OrdersSnapshot {
  seq: number;
  orders: Order[];
}
