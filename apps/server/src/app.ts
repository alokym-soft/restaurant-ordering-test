import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';
import type { ServerConfig } from './config.js';

export interface HealthResponse {
  status: 'ok';
}

export async function buildApp(config: ServerConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env['LOG_LEVEL'] ?? 'info' } });
  app.decorate('config', config);

  await app.register(websocket);

  app.get('/api/health', async (): Promise<HealthResponse> => ({ status: 'ok' }));

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: ServerConfig;
  }
}
