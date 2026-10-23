export interface ServerConfig {
  port: number;
  latencyMs: number;
  failureRate: number;
  statusStepMs: number;
  eventBufferSize: number;
  heartbeatMs: number;
  /** Drops every socket at this interval; `null` disables it. */
  wsDropMs: number | null;
}

type Env = Record<string, string | undefined>;

function readNumber(env: Env, name: string, fallback: number, min = 0): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min) {
    throw new Error(`Invalid value for ${name}: "${raw}"`);
  }
  return value;
}

export function loadConfig(env: Env = process.env): ServerConfig {
  const failureRate = readNumber(env, 'FAILURE_RATE', 0);
  if (failureRate > 1) throw new Error('FAILURE_RATE must be between 0 and 1');
  const wsDrop = readNumber(env, 'WS_DROP_MS', 0);
  return {
    port: readNumber(env, 'PORT', 3000, 1),
    latencyMs: readNumber(env, 'LATENCY_MS', 0),
    failureRate,
    statusStepMs: readNumber(env, 'STATUS_STEP_MS', 8000, 1),
    eventBufferSize: readNumber(env, 'EVENT_BUFFER_SIZE', 1000, 1),
    heartbeatMs: readNumber(env, 'HEARTBEAT_MS', 10000, 1),
    wsDropMs: wsDrop > 0 ? wsDrop : null,
  };
}
