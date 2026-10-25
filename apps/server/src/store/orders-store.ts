import type { Order, OrderId, OrdersSnapshot } from '@restaurant/contracts';

/** What an idempotency key was first used for. */
export interface IdempotencyRecord {
  fingerprint: string;
  orderId: OrderId;
}

/** Orders kept in memory for the lifetime of the process. */
export class OrdersStore {
  readonly orders = new Map<OrderId, Order>();
  /** Idempotency keys never expire; see README "Deliberate simplifications". */
  readonly idempotency = new Map<string, IdempotencyRecord>();
  private nextNumber = 1;

  constructor(private readonly currentSeq: () => number) {}

  snapshot(): OrdersSnapshot {
    return {
      seq: this.currentSeq(),
      orders: [...this.orders.values()].sort((a, b) => b.number - a.number),
    };
  }

  get(id: OrderId): Order | undefined {
    return this.orders.get(id);
  }

  takeNumber(): number {
    return this.nextNumber++;
  }

  save(order: Order): void {
    this.orders.set(order.id, order);
  }

  /** Stores a new order together with its idempotency key and body fingerprint in one step. */
  recordOrder(key: string, fingerprint: string, order: Order): void {
    this.orders.set(order.id, order);
    this.idempotency.set(key, { fingerprint, orderId: order.id });
  }
}
