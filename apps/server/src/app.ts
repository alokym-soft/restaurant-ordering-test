import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import type { ServerConfig } from './config.js';
import { EventBus } from './events/event-bus.js';
import { registerErrorHandling } from './http/error-handler.js';
import { registerFaultInjection } from './http/fault-injection.js';
import { orderRoutes } from './routes/orders.js';
import { readRoutes } from './routes/read.js';
import { setupRoutes } from './routes/setup.js';
import { generateSeed, type SeedData } from './seed.js';
import { StatusScheduler } from './sim/status-scheduler.js';
import { MenuStore } from './store/menu-store.js';
import { OrdersStore } from './store/orders-store.js';
import { realtimeGateway } from './ws/gateway.js';

export interface HealthResponse {
  status: 'ok';
}

export interface Services {
  bus: EventBus;
  menu: MenuStore;
  orders: OrdersStore;
  /** Random id of this server run; `seq` values are only comparable within one epoch. */
  epoch: string;
}

export interface BuildOptions {
  /** Initial menu; defaults to the deterministic demo seed. */
  seed?: SeedData;
  logger?: boolean;
  /** Fixed epoch for tests; defaults to a random UUID. */
  epoch?: string;
  /** Random sources in [0, 1); default `Math.random`. Injectable for deterministic tests. */
  random?: {
    faults?: () => number;
    status?: () => number;
  };
}

export async function buildApp(config: ServerConfig, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger === false ? false : { level: process.env['LOG_LEVEL'] ?? 'info' },
  });

  const bus = new EventBus(config.eventBufferSize, undefined, (error) =>
    app.log.error({ err: error }, 'event listener failed'),
  );
  const currentSeq = (): number => bus.currentSeq;
  const menu = new MenuStore(currentSeq);
  const orders = new OrdersStore(currentSeq);
  const seed = options.seed ?? generateSeed();
  menu.load(seed.categories, seed.items);

  const scheduler = new StatusScheduler(orders, bus, {
    stepMs: config.statusStepMs,
    ...(options.random?.status && { random: options.random.status }),
  });
  app.addHook('onClose', async () => scheduler.stop());

  app.decorate('config', config);
  app.decorate('services', { bus, menu, orders, epoch: options.epoch ?? randomUUID() } satisfies Services);

  registerErrorHandling(app);
  registerFaultInjection(app, {
    latencyMs: config.latencyMs,
    failureRate: config.failureRate,
    random: options.random?.faults ?? Math.random,
  });
  await app.register(websocket);

  app.get('/api/health', async (): Promise<HealthResponse> => ({ status: 'ok' }));
  await app.register(readRoutes);
  await app.register(setupRoutes);
  await app.register(orderRoutes);
  await app.register(realtimeGateway);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
    services: Services;
  }
}
