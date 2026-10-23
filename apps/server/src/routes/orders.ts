import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  API,
  IDEMPOTENCY_HEADER,
  type CreateOrderRequest,
  type MenuChange,
  type MenuChangedError,
  type MenuItem,
  type Order,
  type OrderLine,
} from '@restaurant/contracts';
import { AppError, idempotencyMismatch, validationFailed } from '../http/errors.js';
import { parseCreateOrder } from '../http/validation.js';
import type { MenuStore } from '../store/menu-store.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type MenuChangedDetails = NonNullable<MenuChangedError['details']>;

/**
 * Checks every line against the current menu by value and collects all changes, so the
 * client can show them in one dialog.
 *
 * `itemVersion` is deliberately not compared: a name or description edit bumps the version
 * but must not block checkout. Price, availability, removal and a switch between fixed and
 * open pricing are all caught by comparing values.
 */
export function findMenuChanges(menu: MenuStore, request: CreateOrderRequest): MenuChangedDetails {
  const changes: MenuChange[] = [];
  const affected = new Map<string, MenuItem>();

  for (const line of request.lines) {
    const item = menu.getItem(line.itemId);
    if (!item) {
      changes.push({ kind: 'removed', itemId: line.itemId });
      continue;
    }
    const before = changes.length;
    if (!item.available) {
      changes.push({ kind: 'unavailable', itemId: item.id });
    } else if (item.pricing.kind === 'fixed') {
      if (line.unitPrice !== item.pricing.price) {
        changes.push({ kind: 'price_changed', itemId: item.id, previous: line.unitPrice, current: item.pricing.price });
      }
    } else if (line.unitPrice < item.pricing.min || line.unitPrice > item.pricing.max) {
      changes.push({ kind: 'open_price_out_of_range', itemId: item.id, min: item.pricing.min, max: item.pricing.max });
    }
    if (changes.length > before) affected.set(item.id, item);
  }

  return { changes, items: [...affected.values()] };
}

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  const { menu, orders, bus } = app.services;

  app.post(API.orders, async (request, reply): Promise<Order> => {
    const key = request.headers[IDEMPOTENCY_HEADER.toLowerCase()];
    if (typeof key !== 'string' || !UUID.test(key)) {
      throw validationFailed([{ field: IDEMPOTENCY_HEADER, message: 'header must be a UUID' }]);
    }
    const body = parseCreateOrder(request.body);
    // The parser rebuilds the body with a fixed key order, so this is a canonical form.
    const fingerprint = JSON.stringify(body);

    const previous = orders.idempotency.get(key);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw idempotencyMismatch();
      const existing = orders.get(previous.orderId);
      if (existing) return reply.code(200).send(existing);
    }

    const details = findMenuChanges(menu, body);
    if (details.changes.length > 0) {
      throw new AppError<'MENU_CHANGED', MenuChangedDetails>(409, {
        code: 'MENU_CHANGED',
        message: 'Some items in your cart have changed. Please review them before placing the order.',
        details,
      });
    }

    const lines: OrderLine[] = body.lines.map((line) => {
      // findMenuChanges guarantees every item exists.
      const item = menu.getItem(line.itemId) as MenuItem;
      return {
        itemId: item.id,
        name: item.name,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.unitPrice * line.quantity,
      };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const discount = Math.min(body.discount, subtotal);
    const now = new Date().toISOString();
    const order: Order = {
      id: randomUUID(),
      number: orders.takeNumber(),
      lines,
      subtotal,
      discount,
      total: subtotal - discount,
      status: 'accepted',
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    orders.save(order);
    orders.idempotency.set(key, { fingerprint, orderId: order.id });
    bus.publish({ type: 'order.created', payload: order });
    return reply.code(201).send(order);
  });
}
