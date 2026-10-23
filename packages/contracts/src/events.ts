import type { Category, CategoryId, ItemId, MenuItem } from './menu';
import type { Order, OrderId, OrderStatus } from './orders';

/**
 * A state change broadcast to all clients over the WebSocket.
 * `seq` is global and strictly increasing across all event types.
 */
export interface EventEnvelope<T extends string, P> {
  seq: number;
  type: T;
  at: string;
  payload: P;
}

/** Upserts carry the full entity: idempotent, order-tolerant via `version`. */
export type MenuEvent =
  | EventEnvelope<'menu.category.upserted', Category>
  | EventEnvelope<'menu.category.removed', { id: CategoryId }>
  | EventEnvelope<'menu.item.upserted', MenuItem>
  | EventEnvelope<'menu.item.removed', { id: ItemId }>;

export type OrderEvent =
  | EventEnvelope<'order.created', Order>
  | EventEnvelope<
      'order.status.changed',
      { id: OrderId; status: OrderStatus; version: number; updatedAt: string }
    >;

export type ServerEvent = MenuEvent | OrderEvent;

export type ServerEventType = ServerEvent['type'];
