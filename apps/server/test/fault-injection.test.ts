import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { API, IDEMPOTENCY_HEADER, type CreateOrderRequest, type MenuItem } from '@restaurant/contracts';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { generateSeed } from '../src/seed.js';

/** A random source that returns queued values, then values that never trigger a failure. */
function scripted(values: number[]): () => number {
  return () => values.shift() ?? 0.99;
}

const FAIL = 0; // below FAILURE_RATE
const BEFORE = 0.9; // second roll: fail before applying
const AFTER = 0.1; // second roll: fail after applying

describe('fault injection', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function start(values: number[], env: Record<string, string> = {}): Promise<FastifyInstance> {
    app = await buildApp(loadConfig({ FAILURE_RATE: '0.5', ...env }), {
      seed: generateSeed({ categories: 2, itemsPerCategory: 5 }),
      logger: false,
      random: { faults: scripted(values) },
    });
    return app;
  }

  const fixedItem = (instance: FastifyInstance): MenuItem => {
    const item = [...instance.services.menu.items.values()].find(
      (candidate) => candidate.available && candidate.pricing.kind === 'fixed',
    );
    if (!item) throw new Error('seed has no available fixed-price item');
    return item;
  };

  const orderBody = (item: MenuItem): CreateOrderRequest => ({
    lines: [
      {
        itemId: item.id,
        quantity: 2,
        unitPrice: item.pricing.kind === 'fixed' ? item.pricing.price : item.pricing.min,
        itemVersion: item.version,
      },
    ],
    discount: 0,
  });

  it('a lost order response is recovered by retrying with the same Idempotency-Key', async () => {
    const instance = await start([FAIL, AFTER]);
    const key = randomUUID();
    const body = orderBody(fixedItem(instance));
    const post = () =>
      instance.inject({ method: 'POST', url: API.orders, headers: { [IDEMPOTENCY_HEADER]: key }, payload: body });

    const first = await post();
    expect(first.statusCode).toBe(500);
    expect(first.json()).toMatchObject({ code: 'INTERNAL', message: expect.any(String) });
    expect(instance.services.orders.orders.size).toBe(1);

    const retry = await post();
    expect(retry.statusCode).toBe(200);
    const [created] = [...instance.services.orders.orders.values()];
    expect(retry.json()).toEqual(created);

    const createdEvents = (instance.services.bus.since(0) ?? []).filter((event) => event.type === 'order.created');
    expect(createdEvents).toHaveLength(1);
  });

  it('a mutation can fail before it is applied', async () => {
    const instance = await start([FAIL, BEFORE]);
    const res = await instance.inject({
      method: 'POST',
      url: API.orders,
      headers: { [IDEMPOTENCY_HEADER]: randomUUID() },
      payload: orderBody(fixedItem(instance)),
    });
    expect(res.statusCode).toBe(500);
    expect(instance.services.orders.orders.size).toBe(0);
    expect(instance.services.bus.currentSeq).toBe(0);
  });

  it('a setup mutation failing after apply still publishes its event', async () => {
    const instance = await start([FAIL, AFTER]);
    const res = await instance.inject({ method: 'POST', url: API.setupCategories, payload: { name: 'Desserts' } });
    expect(res.statusCode).toBe(500);
    expect(instance.services.bus.since(0)?.map((event) => event.type)).toEqual(['menu.category.upserted']);
  });

  it('a failing read fails without a second roll', async () => {
    const instance = await start([FAIL]);
    const res = await instance.inject({ method: 'GET', url: API.menu });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ code: 'INTERNAL' });
  });

  it('never affects /api/health', async () => {
    const instance = await start([FAIL, FAIL, FAIL], { FAILURE_RATE: '1' });
    const res = await instance.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
  });
});
