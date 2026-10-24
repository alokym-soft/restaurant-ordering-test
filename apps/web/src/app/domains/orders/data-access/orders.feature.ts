import { createEntityAdapter, type EntityState } from '@ngrx/entity';
import { createFeature, createReducer, on } from '@ngrx/store';
import type { Order, OrderEvent } from '@restaurant/contracts';
import type { HttpApiError } from '@core/http';
import { CheckoutApiActions } from '@cart';
import { OrdersApiActions, OrdersStreamActions } from './orders.actions';

export type OrdersLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface OrdersState {
  orders: EntityState<Order>;
  snapshotSeq: number | null;
  /** Highest `seq` applied; older or repeated events are ignored. */
  lastSeq: number | null;
  status: OrdersLoadStatus;
  error: HttpApiError | null;
}

export const orderAdapter = createEntityAdapter<Order>();

export const initialOrdersState: OrdersState = {
  orders: orderAdapter.getInitialState(),
  snapshotSeq: null,
  lastSeq: null,
  status: 'idle',
  error: null,
};

function isNewer(stored: Order | undefined, version: number): boolean {
  return !stored || stored.version < version;
}

/**
 * Applies a batch of events in one pass. Events at or below `lastSeq` are skipped; a change wins
 * only if its `version` is newer, so a late `order.created` cannot roll back a newer status.
 */
export function applyOrderEvents(state: OrdersState, events: readonly OrderEvent[]): OrdersState {
  const pending = new Map<string, Order>();
  const current = (id: string): Order | undefined => pending.get(id) ?? state.orders.entities[id];
  let lastSeq = state.lastSeq;

  for (const event of events) {
    if (lastSeq !== null && event.seq <= lastSeq) continue;
    lastSeq = event.seq;
    if (event.type === 'order.created') {
      if (isNewer(current(event.payload.id), event.payload.version)) pending.set(event.payload.id, event.payload);
    } else {
      const { id, status, version, updatedAt } = event.payload;
      const stored = current(id);
      // A status for an unknown order is skipped; the next snapshot brings the full order.
      if (stored && stored.version < version) pending.set(id, { ...stored, status, version, updatedAt });
    }
  }

  if (lastSeq === state.lastSeq) return state;
  return {
    ...state,
    lastSeq,
    orders: pending.size === 0 ? state.orders : orderAdapter.upsertMany([...pending.values()], state.orders),
  };
}

export const ordersFeature = createFeature({
  name: 'orders',
  reducer: createReducer(
    initialOrdersState,
    on(OrdersApiActions.snapshotRequested, (state): OrdersState => ({ ...state, status: 'loading', error: null })),
    on(
      OrdersApiActions.snapshotLoaded,
      (state, { snapshot }): OrdersState => ({
        ...state,
        orders: orderAdapter.setAll(snapshot.orders, state.orders),
        snapshotSeq: snapshot.seq,
        lastSeq: snapshot.seq,
        status: 'loaded',
        error: null,
      }),
    ),
    on(OrdersApiActions.snapshotFailed, (state, { error }): OrdersState => ({ ...state, status: 'error', error })),
    on(OrdersStreamActions.eventsApplied, (state, { events }) => applyOrderEvents(state, events)),
    // The just-placed order is shown before its event arrives; the version check keeps it consistent.
    on(CheckoutApiActions.orderPlaced, (state, { order }): OrdersState =>
      isNewer(state.orders.entities[order.id], order.version)
        ? { ...state, orders: orderAdapter.upsertOne(order, state.orders) }
        : state,
    ),
  ),
});
