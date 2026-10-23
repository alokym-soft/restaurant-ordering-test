import type { FastifyInstance } from 'fastify';
import type { MenuItem, OrderLineRequest } from '@restaurant/contracts';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { generateSeed } from '../src/seed.js';

/** Small, deterministic app with no fault injection. */
export function makeApp(env: Record<string, string> = {}): Promise<FastifyInstance> {
  return buildApp(loadConfig(env), {
    seed: generateSeed({ categories: 2, itemsPerCategory: 20 }),
    logger: false,
  });
}

export function findItem(app: FastifyInstance, predicate: (item: MenuItem) => boolean): MenuItem {
  const item = [...app.services.menu.items.values()].find(predicate);
  if (!item) throw new Error('no matching item in the test seed');
  return item;
}

export const fixedItem = (app: FastifyInstance, skip: string[] = []): MenuItem =>
  findItem(app, (item) => item.available && item.pricing.kind === 'fixed' && !skip.includes(item.id));

export const openItem = (app: FastifyInstance): MenuItem =>
  findItem(app, (item) => item.available && item.pricing.kind === 'open');

/** A line exactly matching the current menu. */
export function lineFor(item: MenuItem, quantity = 1): OrderLineRequest {
  const unitPrice = item.pricing.kind === 'fixed' ? item.pricing.price : item.pricing.min;
  return { itemId: item.id, quantity, unitPrice, itemVersion: item.version };
}
