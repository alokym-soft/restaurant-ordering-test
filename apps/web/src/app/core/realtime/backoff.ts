/** Reconnect delays: exponential backoff with full jitter (AWS architecture blog variant). */
export interface BackoffOptions {
  baseMs: number;
  capMs: number;
}

export const DEFAULT_BACKOFF: BackoffOptions = { baseMs: 500, capMs: 15_000 };

/**
 * Delay before reconnect attempt number `attempt` (0-based): a uniformly random value in
 * `[0, min(cap, base * 2^attempt))`. Full jitter spreads clients out after a server restart.
 */
export function fullJitterDelay(
  attempt: number,
  random: () => number = Math.random,
  { baseMs, capMs }: BackoffOptions = DEFAULT_BACKOFF,
): number {
  const ceiling = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.floor(random() * ceiling);
}
