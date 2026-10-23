import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@restaurant/contracts';
import { EventBus } from '../src/events/event-bus.js';
import { StatusScheduler } from '../src/sim/status-scheduler.js';
import { OrdersStore } from '../src/store/orders-store.js';

const STEP_MS = 1000;

function makeOrder(orders: OrdersStore, id: string): Order {
  const now = new Date().toISOString();
  const order: Order = {
    id,
    number: orders.takeNumber(),
    lines: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    status: 'accepted',
    createdAt: now,
    updatedAt: now,
    version: 1,
  };
  orders.save(order);
  return order;
}

describe('StatusScheduler', () => {
  let bus: EventBus;
  let orders: OrdersStore;
  let scheduler: StatusScheduler;
  let random: () => number;

  beforeEach(() => {
    vi.useFakeTimers();
    bus = new EventBus(1000);
    orders = new OrdersStore(() => bus.currentSeq);
    random = () => 0.5; // no jitter
    scheduler = new StatusScheduler(orders, bus, { stepMs: STEP_MS, random: () => random() });
  });

  afterEach(() => {
    scheduler.stop();
    vi.useRealTimers();
  });

  const create = (id: string): void => {
    bus.publish({ type: 'order.created', payload: makeOrder(orders, id) });
  };
  const statusEvents = () => (bus.since(0) ?? []).filter((event) => event.type === 'order.status.changed');

  it('walks an order to completed, bumping version and emitting one event per step', () => {
    create('o1');
    vi.advanceTimersByTime(STEP_MS - 1);
    expect(orders.get('o1')?.status).toBe('accepted');

    vi.advanceTimersByTime(1);
    expect(orders.get('o1')).toMatchObject({ status: 'preparing', version: 2 });

    vi.advanceTimersByTime(STEP_MS * 10);
    expect(orders.get('o1')).toMatchObject({ status: 'completed', version: 4 });
    expect(statusEvents().map((event) => event.payload)).toEqual([
      expect.objectContaining({ id: 'o1', status: 'preparing', version: 2 }),
      expect.objectContaining({ id: 'o1', status: 'ready', version: 3 }),
      expect.objectContaining({ id: 'o1', status: 'completed', version: 4 }),
    ]);
    expect(scheduler.pending).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('uses a single timer for many orders', () => {
    for (let i = 0; i < 50; i++) create(`o${i}`);
    expect(scheduler.pending).toBe(50);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(STEP_MS * 3);
    expect([...orders.orders.values()].every((order) => order.status === 'completed')).toBe(true);
    expect(statusEvents()).toHaveLength(150);
  });

  it('applies jitter of up to ±30%', () => {
    random = () => 0; // shortest delay
    create('fast');
    vi.advanceTimersByTime(STEP_MS * 0.7);
    expect(orders.get('fast')?.status).toBe('preparing');

    random = () => 0.999_999; // longest delay
    create('slow');
    vi.advanceTimersByTime(STEP_MS * 1.29);
    expect(orders.get('slow')?.status).toBe('accepted');
    vi.advanceTimersByTime(STEP_MS * 0.02);
    expect(orders.get('slow')?.status).toBe('preparing');
  });

  it('clears its timer on stop', () => {
    create('o1');
    scheduler.stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(STEP_MS * 10);
    expect(orders.get('o1')?.status).toBe('accepted');
  });
});
