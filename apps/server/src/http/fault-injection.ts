import type { FastifyInstance, FastifyRequest } from 'fastify';
import { API } from '@restaurant/contracts';
import { internalError } from './errors.js';

const EXCLUDED_PATHS = new Set<string>(['/api/health', API.ws]);
const MUTATIONS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

export interface FaultInjectionOptions {
  latencyMs: number;
  failureRate: number;
  /** Returns a number in [0, 1); injectable for deterministic tests. */
  random: () => number;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Set when this mutation must fail after it has been applied. */
    failAfterApply?: boolean;
  }
}

const isInjectable = (request: FastifyRequest): boolean => {
  const path = request.url.split('?')[0] ?? '';
  return path.startsWith('/api/') && !EXCLUDED_PATHS.has(path);
};

/**
 * Artificial latency and failures for REST endpoints (never `/api/ws` or `/api/health`).
 *
 * A failing GET fails before the handler runs. A failing mutation fails before the handler
 * in half the cases; in the other half the change and its event are applied and only the
 * response is replaced with a 500, which simulates a response lost on the way back.
 */
export function registerFaultInjection(app: FastifyInstance, options: FaultInjectionOptions): void {
  const { latencyMs, failureRate, random } = options;
  if (latencyMs <= 0 && failureRate <= 0) return;

  app.addHook('onRequest', async (request) => {
    if (!isInjectable(request)) return;
    if (latencyMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, latencyMs).unref());
    }
    if (failureRate <= 0 || random() >= failureRate) return;
    if (MUTATIONS.has(request.method) && random() < 0.5) {
      request.failAfterApply = true;
      return;
    }
    throw internalError();
  });

  app.addHook('onSend', async (request, reply, payload) => {
    if (!request.failAfterApply || reply.statusCode >= 400) return payload;
    request.log.info('fault injection: response dropped after the change was applied');
    const error = internalError();
    reply.code(error.statusCode).header('content-type', 'application/json; charset=utf-8');
    return JSON.stringify(error.body);
  });
}
