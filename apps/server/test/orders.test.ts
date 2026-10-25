import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { API, IDEMPOTENCY_HEADER, type CreateOrderRequest, type MenuItem } from '@restaurant/contracts';
import { fixedItem, lineFor, makeApp, openItem } from './helpers.js';

describe('POST /api/orders', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await makeApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const post = (body: unknown, key: string | null = randomUUID()) =>
    app.inject({
      method: 'POST',
      url: API.orders,
      headers: key === null ? {} : { [IDEMPOTENCY_HEADER]: key },
      payload: body as object,
    });

  const events = (type: string) => (app.services.bus.since(0) ?? []).filter((event) => event.type === type);

  const setItem = (item: MenuItem, changes: Partial<MenuItem>): void => {
    app.services.menu.items.set(item.id, { ...item, ...changes, version: item.version + 1 });
  };

  it('creates an order with server-side totals and name snapshots', async () => {
    const item = fixedItem(app);
    const res = await post({ lines: [lineFor(item, 3)], discount: 0 });

    expect(res.statusCode).toBe(201);
    const price = item.pricing.kind === 'fixed' ? item.pricing.price : 0;
    expect(res.json()).toMatchObject({
      number: 1,
      status: 'accepted',
      version: 1,
      subtotal: price * 3,
      total: price * 3,
      lines: [{ itemId: item.id, name: item.name, unitPrice: price, quantity: 3, lineTotal: price * 3 }],
    });
    expect(events('order.created')).toHaveLength(1);
  });

  it('replays the original order for the same key and body', async () => {
    const key = randomUUID();
    const body: CreateOrderRequest = { lines: [lineFor(fixedItem(app))], discount: 0 };
    const first = await post(body, key);
    const second = await post(body, key);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual(first.json());
    expect(app.services.orders.orders.size).toBe(1);
    expect(events('order.created')).toHaveLength(1);
  });

  it('never creates an order for a known key whose order is missing', async () => {
    const key = randomUUID();
    const body: CreateOrderRequest = { lines: [lineFor(fixedItem(app))], discount: 0 };
    const first = await post(body, key);
    app.services.orders.orders.delete(first.json().id); // simulate a lost order record

    const retry = await post(body, key);

    expect(retry.statusCode).toBe(500);
    expect(retry.json()).toMatchObject({ code: 'INTERNAL' });
    expect(app.services.orders.orders.size).toBe(0);
    expect(events('order.created')).toHaveLength(1);
  });

  it('rejects the same key with a different body', async () => {
    const key = randomUUID();
    const item = fixedItem(app);
    await post({ lines: [lineFor(item, 1)], discount: 0 }, key);
    const res = await post({ lines: [lineFor(item, 2)], discount: 0 }, key);

    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ code: 'IDEMPOTENCY_MISMATCH' });
    expect(app.services.orders.orders.size).toBe(1);
  });

  it.each([
    ['missing', null],
    ['not a UUID', 'abc'],
  ])('requires a UUID Idempotency-Key (%s)', async (_label, key) => {
    const res = await post({ lines: [lineFor(fixedItem(app))], discount: 0 }, key);
    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('collects every menu change in one MENU_CHANGED response', async () => {
    const priced = fixedItem(app);
    const disabled = fixedItem(app, [priced.id]);
    const removed = fixedItem(app, [priced.id, disabled.id]);
    const open = openItem(app);
    const lines = [lineFor(priced), lineFor(disabled), lineFor(removed), { ...lineFor(open), unitPrice: 0 }];

    const newPrice = (priced.pricing.kind === 'fixed' ? priced.pricing.price : 0) + 500;
    setItem(priced, { pricing: { kind: 'fixed', price: newPrice } });
    setItem(disabled, { available: false });
    app.services.menu.items.delete(removed.id);
    setItem(open, { pricing: { kind: 'open', min: 1000, max: 2000 } });

    const res = await post({ lines, discount: 0 });

    expect(res.statusCode).toBe(409);
    const body = res.json();
    expect(body.code).toBe('MENU_CHANGED');
    expect(body.details.changes).toEqual([
      { kind: 'price_changed', itemId: priced.id, previous: lines[0]?.unitPrice, current: newPrice },
      { kind: 'unavailable', itemId: disabled.id },
      { kind: 'removed', itemId: removed.id },
      { kind: 'open_price_out_of_range', itemId: open.id, min: 1000, max: 2000 },
    ]);
    expect(body.details.items.map((item: MenuItem) => item.id).sort()).toEqual([priced.id, disabled.id, open.id].sort());
    expect(app.services.orders.orders.size).toBe(0);
  });

  it('does not block checkout on a version-only change (name edit)', async () => {
    const item = fixedItem(app);
    const line = lineFor(item);
    setItem(item, { name: 'Renamed' });

    const res = await post({ lines: [line], discount: 0 });
    expect(res.statusCode).toBe(201);
    expect(res.json().lines[0].name).toBe('Renamed');
  });

  it('clamps the discount to the subtotal', async () => {
    const item = fixedItem(app);
    const res = await post({ lines: [lineFor(item)], discount: 999_999 });
    expect(res.statusCode).toBe(201);
    const order = res.json();
    expect(order.discount).toBe(order.subtotal);
    expect(order.total).toBe(0);
  });

  it.each([0, 100, 1.5])('rejects quantity %s', async (quantity) => {
    const res = await post({ lines: [{ ...lineFor(fixedItem(app)), quantity }], discount: 0 });
    expect(res.statusCode).toBe(400);
    expect(res.json().details.fields[0].field).toBe('lines[0].quantity');
  });

  it('rejects an empty order and a negative discount', async () => {
    const res = await post({ lines: [], discount: -1 });
    expect(res.statusCode).toBe(400);
    expect(res.json().details.fields.map((field: { field: string }) => field.field).sort()).toEqual(['discount', 'lines']);
  });
});
