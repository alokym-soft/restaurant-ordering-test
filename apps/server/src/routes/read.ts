import type { FastifyInstance } from 'fastify';
import { API, type MenuSnapshot, type Order, type OrdersSnapshot } from '@restaurant/contracts';
import { notFound } from '../http/errors.js';

export async function readRoutes(app: FastifyInstance): Promise<void> {
  const { menu, orders } = app.services;

  app.get(API.menu, async (): Promise<MenuSnapshot> => menu.snapshot());

  app.get(API.orders, async (): Promise<OrdersSnapshot> => orders.snapshot());

  app.get<{ Params: { id: string } }>('/api/orders/:id', async (request): Promise<Order> => {
    const order = orders.get(request.params.id);
    if (!order) throw notFound('Order not found.');
    return order;
  });
}
