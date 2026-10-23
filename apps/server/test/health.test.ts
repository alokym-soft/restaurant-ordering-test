import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /api/health', () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it('answers ok', async () => {
    app = await buildApp(loadConfig({}));
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});

describe('loadConfig', () => {
  it('uses defaults', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      latencyMs: 0,
      failureRate: 0,
      statusStepMs: 8000,
      eventBufferSize: 1000,
      heartbeatMs: 10000,
      wsDropMs: null,
    });
  });

  it('rejects invalid numbers', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(/PORT/);
    expect(() => loadConfig({ FAILURE_RATE: '2' })).toThrow(/FAILURE_RATE/);
  });
});
