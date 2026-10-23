import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { API, type Category, type MenuItem } from '@restaurant/contracts';
import { categoryNotEmpty, notFound, validationFailed, versionConflict } from '../http/errors.js';
import {
  parseCreateCategory,
  parseCreateItem,
  parseUpdateCategory,
  parseUpdateItem,
} from '../http/validation.js';

interface IdParams {
  id: string;
}

const nextSortOrder = (entries: Iterable<{ sortOrder: number }>): number => {
  let max = -1;
  for (const entry of entries) max = Math.max(max, entry.sortOrder);
  return max + 1;
};

/**
 * Setup CRUD. Updates use optimistic concurrency (`expectedVersion`); every successful
 * mutation is published on the event bus, which is how all clients (including the
 * one that made the change) update their menu.
 */
export async function setupRoutes(app: FastifyInstance): Promise<void> {
  const { menu, bus } = app.services;

  const requireCategory = (field: string, id: string): void => {
    if (!menu.categories.has(id)) throw validationFailed([{ field, message: 'refers to an unknown category' }]);
  };

  app.post(API.setupCategories, async (request, reply): Promise<Category> => {
    const body = parseCreateCategory(request.body);
    const category: Category = {
      id: `cat-${randomUUID()}`,
      name: body.name,
      sortOrder: body.sortOrder ?? nextSortOrder(menu.categories.values()),
      version: 1,
    };
    menu.categories.set(category.id, category);
    bus.publish({ type: 'menu.category.upserted', payload: category });
    return reply.code(201).send(category);
  });

  app.patch<{ Params: IdParams }>('/api/setup/categories/:id', async (request): Promise<Category> => {
    const body = parseUpdateCategory(request.body);
    const current = menu.categories.get(request.params.id);
    if (!current) throw notFound('This category no longer exists.');
    if (current.version !== body.expectedVersion) throw versionConflict(current);

    const updated: Category = {
      ...current,
      ...(body.name !== undefined && { name: body.name }),
      ...(body.sortOrder !== undefined && { sortOrder: body.sortOrder }),
      version: current.version + 1,
    };
    menu.categories.set(updated.id, updated);
    bus.publish({ type: 'menu.category.upserted', payload: updated });
    return updated;
  });

  app.delete<{ Params: IdParams }>('/api/setup/categories/:id', async (request, reply): Promise<FastifyReply> => {
    const { id } = request.params;
    if (!menu.categories.has(id)) throw notFound('This category no longer exists.');
    for (const item of menu.items.values()) {
      if (item.categoryId === id) throw categoryNotEmpty();
    }
    menu.categories.delete(id);
    bus.publish({ type: 'menu.category.removed', payload: { id } });
    return reply.code(204).send();
  });

  app.post(API.setupItems, async (request, reply): Promise<MenuItem> => {
    const body = parseCreateItem(request.body);
    requireCategory('categoryId', body.categoryId);
    const siblings = [...menu.items.values()].filter((item) => item.categoryId === body.categoryId);
    const item: MenuItem = {
      id: `item-${randomUUID()}`,
      categoryId: body.categoryId,
      name: body.name,
      ...(body.description && { description: body.description }),
      pricing: body.pricing,
      available: body.available ?? true,
      sortOrder: body.sortOrder ?? nextSortOrder(siblings),
      version: 1,
    };
    menu.items.set(item.id, item);
    bus.publish({ type: 'menu.item.upserted', payload: item });
    return reply.code(201).send(item);
  });

  app.patch<{ Params: IdParams }>('/api/setup/items/:id', async (request): Promise<MenuItem> => {
    const body = parseUpdateItem(request.body);
    const current = menu.items.get(request.params.id);
    if (!current) throw notFound('This item no longer exists.');
    if (current.version !== body.expectedVersion) throw versionConflict(current);
    if (body.categoryId !== undefined) requireCategory('categoryId', body.categoryId);

    const { expectedVersion: _expectedVersion, description, ...changes } = body;
    const updated: MenuItem = { ...current, ...changes, version: current.version + 1 };
    if (description !== undefined) {
      if (description) updated.description = description;
      else delete updated.description;
    }
    menu.items.set(updated.id, updated);
    bus.publish({ type: 'menu.item.upserted', payload: updated });
    return updated;
  });

  app.delete<{ Params: IdParams }>('/api/setup/items/:id', async (request, reply): Promise<FastifyReply> => {
    const { id } = request.params;
    if (!menu.items.delete(id)) throw notFound('This item no longer exists.');
    bus.publish({ type: 'menu.item.removed', payload: { id } });
    return reply.code(204).send();
  });
}
