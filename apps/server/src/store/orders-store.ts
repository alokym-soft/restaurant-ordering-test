import type { Order, OrderId, OrdersSnapshot } from '@restaurant/contracts';

/** Orders kept in memory for the lifetime of the process. */
export class OrdersStore {
  readonly orders = new Map<OrderId, Order>();
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
}
