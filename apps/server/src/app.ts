import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import type { ServerConfig } from './config.js';
import { registerErrorHandling } from './http/error-handler.js';
import { readRoutes } from './routes/read.js';
import { type SeedData, generateSeed } from './seed.js';
import { MenuStore } from './store/menu-store.js';
import { OrdersStore } from './store/orders-store.js';

export interface HealthResponse {
  status: 'ok';
}

export interface Services {
  menu: MenuStore;
  orders: OrdersStore;
}

export interface BuildOptions {
  /** Initial menu; defaults to the deterministic demo seed. */
  seed?: SeedData;
  logger?: boolean;
}

export async function buildApp(config: ServerConfig, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger === false ? false : { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  const currentSeq = (): number => 0;
  const menu = new MenuStore(currentSeq);
  const orders = new OrdersStore(currentSeq);
  const seed = options.seed ?? generateSeed();
  menu.load(seed.categories, seed.items);

  app.decorate('config', config);
  app.decorate('services', { menu, orders } satisfies Services);

  registerErrorHandling(app);
  await app.register(websocket);

  app.get('/api/health', async (): Promise<HealthResponse> => ({ status: 'ok' }));
  await app.register(readRoutes);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
    services: Services;
  }
}
