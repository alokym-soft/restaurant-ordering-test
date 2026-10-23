import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { API } from '@restaurant/contracts';
import { fixedItem, makeApp } from './helpers.js';

describe('setup CRUD', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await makeApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const eventTypes = () => (app.services.bus.since(0) ?? []).map((event) => event.type);

  it('creates a category at version 1 at the end of the list', async () => {
    const res = await app.inject({ method: 'POST', url: API.setupCategories, payload: { name: '  Desserts ' } });
    expect(res.statusCode).toBe(201);
    const maxSortOrder = Math.max(...[...app.services.menu.categories.values()].filter((c) => c.name !== 'Desserts').map((c) => c.sortOrder));
    expect(res.json()).toMatchObject({ name: 'Desserts', version: 1, sortOrder: maxSortOrder + 1 });
    expect(eventTypes()).toEqual(['menu.category.upserted']);
  });

  it('updates with the expected version and bumps it', async () => {
    const item = fixedItem(app);
    const res = await app.inject({
      method: 'PATCH',
      url: API.setupItem(item.id),
      payload: { expectedVersion: item.version, available: false },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ id: item.id, available: false, version: item.version + 1 });
    expect(eventTypes()).toEqual(['menu.item.upserted']);
  });

  it('answers VERSION_CONFLICT with the current entity for a stale version', async () => {
    const item = fixedItem(app);
    const patch = (name: string) =>
      app.inject({ method: 'PATCH', url: API.setupItem(item.id), payload: { expectedVersion: item.version, name } });

    expect((await patch('First')).statusCode).toBe(200);
    const res = await patch('Second');

    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      code: 'VERSION_CONFLICT',
      details: { current: { id: item.id, name: 'First', version: item.version + 1 } },
    });
  });

  it('requires expectedVersion on PATCH', async () => {
    const item = fixedItem(app);
    const res = await app.inject({ method: 'PATCH', url: API.setupItem(item.id), payload: { name: 'X' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().details.fields[0].field).toBe('expectedVersion');
  });

  it('validates open pricing bounds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: API.setupItems,
      payload: { categoryId: 'cat-001', name: 'Tip', pricing: { kind: 'open', min: 500, max: 100 } },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().details.fields[0].field).toBe('pricing.max');
  });

  it('refuses to delete a category that still has items', async () => {
    const res = await app.inject({ method: 'DELETE', url: API.setupCategory('cat-001') });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({ code: 'CATEGORY_NOT_EMPTY' });
    expect(app.services.menu.categories.has('cat-001')).toBe(true);
  });

  it('deletes an item, then answers 404 for it', async () => {
    const item = fixedItem(app);
    const first = await app.inject({ method: 'DELETE', url: API.setupItem(item.id) });
    const second = await app.inject({ method: 'DELETE', url: API.setupItem(item.id) });

    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(404);
    expect(second.json()).toMatchObject({ code: 'NOT_FOUND' });
    expect(eventTypes()).toEqual(['menu.item.removed']);
  });

  it('deletes an empty category', async () => {
    const created = await app.inject({ method: 'POST', url: API.setupCategories, payload: { name: 'Empty' } });
    const res = await app.inject({ method: 'DELETE', url: API.setupCategory(created.json().id) });
    expect(res.statusCode).toBe(204);
    expect(eventTypes()).toEqual(['menu.category.upserted', 'menu.category.removed']);
  });
});
