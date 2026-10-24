import type { Order, OrderEvent } from '@restaurant/contracts';
import { CheckoutApiActions } from '@cart';
import { OrdersApiActions, OrdersStreamActions } from './orders.actions';
import { type OrdersState, initialOrdersState, ordersFeature } from './orders.feature';
import { selectOrderIdsNewestFirst } from './orders.selectors';

const at = '2026-10-24T12:00:00.000Z';

function order(id: string, number: number, overrides: Partial<Order> = {}): Order {
  return {
    id,
    number,
    lines: [],
    subtotal: 1000,
    discount: 0,
    total: 1000,
    status: 'accepted',
    createdAt: at,
    updatedAt: at,
    version: 1,
    ...overrides,
  };
}

const created = (seq: number, value: Order): OrderEvent => ({ seq, at, type: 'order.created', payload: value });
const statusChanged = (seq: number, id: string, status: Order['status'], version: number): OrderEvent => ({
  seq,
  at,
  type: 'order.status.changed',
  payload: { id, status, version, updatedAt: at },
});

const reducer = ordersFeature.reducer;
const loaded = (seq: number, orders: Order[]): OrdersState =>
  reducer(initialOrdersState, OrdersApiActions.snapshotLoaded({ snapshot: { seq, orders } }));
const apply = (state: OrdersState, ...events: OrderEvent[]) =>
  reducer(state, OrdersStreamActions.eventsApplied({ events }));

describe('orders reducer', () => {
  it('adds created orders and applies newer statuses', () => {
    const state = apply(loaded(1, []), created(2, order('o1', 1)), statusChanged(3, 'o1', 'preparing', 2));
    expect(state.orders.entities['o1']).toMatchObject({ status: 'preparing', version: 2 });
    expect(state.lastSeq).toBe(3);
  });

  it('ignores events already covered by the snapshot or applied before', () => {
    const state = loaded(5, [order('o1', 1, { status: 'ready', version: 3 })]);
    expect(apply(state, statusChanged(4, 'o1', 'preparing', 2))).toBe(state);
  });

  it('never rolls a status back to an older version', () => {
    const state = loaded(1, [order('o1', 1, { status: 'ready', version: 3 })]);
    const next = apply(state, statusChanged(2, 'o1', 'preparing', 2), created(3, order('o1', 1)));
    expect(next.orders.entities['o1']).toMatchObject({ status: 'ready', version: 3 });
    expect(next.lastSeq).toBe(3);
  });

  it('skips a status for an unknown order', () => {
    const next = apply(loaded(1, []), statusChanged(2, 'missing', 'ready', 2));
    expect(next.orders.ids).toEqual([]);
  });

  it('shows the order from checkout before its event, without overwriting a newer one', () => {
    const placed = reducer(loaded(1, []), CheckoutApiActions.orderPlaced({ order: order('o1', 1) }));
    expect(placed.orders.entities['o1']?.status).toBe('accepted');
    const newer = apply(placed, statusChanged(2, 'o1', 'preparing', 2));
    expect(reducer(newer, CheckoutApiActions.orderPlaced({ order: order('o1', 1) }))).toBe(newer);
  });
});

describe('selectOrderIdsNewestFirst', () => {
  it('sorts newest first and keeps its reference when only statuses change', () => {
    const state = loaded(1, [order('a', 1), order('b', 2)]);
    const first = selectOrderIdsNewestFirst.projector(state.orders);
    expect(first).toEqual(['b', 'a']);
    const changed = apply(state, statusChanged(2, 'a', 'preparing', 2));
    expect(selectOrderIdsNewestFirst({ orders: changed })).toEqual(['b', 'a']);
    expect(selectOrderIdsNewestFirst({ orders: apply(changed, statusChanged(3, 'a', 'ready', 3)) })).toBe(
      selectOrderIdsNewestFirst({ orders: changed }),
    );
  });
});
