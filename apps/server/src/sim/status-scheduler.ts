import type { OrderId, OrderStatus } from '@restaurant/contracts';
import type { EventBus } from '../events/event-bus.js';
import type { OrdersStore } from '../store/orders-store.js';

/** `cancelled` is never produced; see README "Deliberate simplifications". */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

export const STATUS_JITTER = 0.3;

export interface StatusSchedulerOptions {
  stepMs: number;
  /** Returns a number in [0, 1); injectable for deterministic tests. */
  random?: () => number;
}

interface Due {
  orderId: OrderId;
  at: number;
}

/**
 * Moves orders through `accepted → preparing → ready → completed`.
 *
 * A single timer is armed for the earliest due step, regardless of how many orders are in
 * progress; the queue holds at most one entry per active order.
 */
export class StatusScheduler {
  private readonly queue: Due[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly unsubscribe: () => void;
  private readonly random: () => number;

  constructor(
    private readonly orders: OrdersStore,
    private readonly bus: EventBus,
    private readonly options: StatusSchedulerOptions,
  ) {
    this.random = options.random ?? Math.random;
    this.unsubscribe = bus.subscribe((event) => {
      if (event.type === 'order.created') this.schedule(event.payload.id);
    });
  }

  /** Number of orders waiting for their next step. */
  get pending(): number {
    return this.queue.length;
  }

  stop(): void {
    this.unsubscribe();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue.length = 0;
  }

  private delay(): number {
    const factor = 1 + (this.random() * 2 - 1) * STATUS_JITTER;
    return Math.max(1, Math.round(this.options.stepMs * factor));
  }

  private schedule(orderId: OrderId): void {
    const due: Due = { orderId, at: Date.now() + this.delay() };
    const index = this.queue.findIndex((entry) => entry.at > due.at);
    if (index === -1) this.queue.push(due);
    else this.queue.splice(index, 0, due);
    this.arm();
  }

  private arm(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const first = this.queue[0];
    if (!first) return;
    this.timer = setTimeout(() => this.tick(), Math.max(0, first.at - Date.now()));
    this.timer.unref();
  }

  private tick(): void {
    this.timer = null;
    const now = Date.now();
    while (this.queue[0] && this.queue[0].at <= now) {
      const { orderId } = this.queue.shift() as Due;
      this.advance(orderId);
    }
    this.arm();
  }

  private advance(orderId: OrderId): void {
    const order = this.orders.get(orderId);
    const next = order ? NEXT_STATUS[order.status] : undefined;
    if (!order || !next) return;

    const updated = { ...order, status: next, version: order.version + 1, updatedAt: new Date().toISOString() };
    this.orders.save(updated);
    this.bus.publish({
      type: 'order.status.changed',
      payload: { id: updated.id, status: updated.status, version: updated.version, updatedAt: updated.updatedAt },
    });
    if (NEXT_STATUS[next]) this.schedule(orderId);
  }
}
