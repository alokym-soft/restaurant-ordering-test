import type { ServerEvent } from './events';

/**
 * WebSocket protocol on /api/ws. Every frame is a JSON object with a `type`.
 *
 * Connection lifecycle:
 *   1. Client opens the socket and sends `hello` with the last `seq` it has seen
 *      (null on the very first connection: live events only, no replay).
 *   2. Server answers `welcome` with its current seq and heartbeat interval.
 *   3. If `lastSeq` is still in the server's buffer, the server replays every event
 *      with seq > lastSeq, then continues live. If it is older than the buffer,
 *      the server sends `resync_required` and continues live; the client refetches snapshots.
 *   4. Server sends `ping` every `heartbeatMs`; client answers `pong`.
 *      The client treats ~3 intervals of silence as a dead connection and reconnects.
 *      The server closes sockets that miss pongs for the same period.
 *
 * Commands (orders, setup) do not go over the socket: they use REST.
 */

export type ClientMessage =
  | { type: 'hello'; lastSeq: number | null }
  | { type: 'pong'; ts: number };

export type ServerMessage =
  | { type: 'welcome'; serverSeq: number; heartbeatMs: number }
  | { type: 'ping'; ts: number }
  | { type: 'event'; event: ServerEvent }
  | { type: 'resync_required'; oldestAvailableSeq: number; serverSeq: number };

/** Application close codes (4000–4999 range is reserved for applications). */
export const WS_CLOSE = {
  NORMAL: 1000,
  GOING_AWAY: 1001,
  /** Malformed frame or missing `hello`; the client should not retry with the same payload. */
  PROTOCOL_ERROR: 4400,
  /** Missed heartbeats; the client should reconnect. */
  HEARTBEAT_TIMEOUT: 4408,
} as const;
