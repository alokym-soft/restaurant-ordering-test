import type { ServerEvent } from './events';

/**
 * WebSocket protocol on /api/ws. Every frame is a JSON object with a `type`.
 *
 * Connection lifecycle:
 *   1. Client opens the socket and sends `hello` with the last `seq` it has seen and the server
 *      `epoch` it belongs to (both null on the very first connection: live events only, no replay).
 *   2. Server answers `welcome` with its current seq, epoch and heartbeat interval.
 *   3. If the epoch matches and `lastSeq` is still in the server's buffer, the server replays every
 *      event with seq > lastSeq, then continues live. If the epoch differs, `lastSeq` is ahead of the
 *      server, or it is older than the buffer, the server sends `resync_required` and continues
 *      live; the client refetches snapshots.
 *      After `welcome` events arrive with consecutive `seq`; a gap means events were lost.
 *   4. Server sends `ping` every `heartbeatMs`; client answers `pong`.
 *      The client treats ~3 intervals of silence as a dead connection and reconnects.
 *      The server closes sockets that miss pongs for the same period.
 *
 * Commands (orders, setup) do not go over the socket: they use REST.
 */

export type ClientMessage =
  | {
      type: 'hello';
      lastSeq: number | null;
      /**
       * The `epoch` from the last `welcome` this client received; null on the very first connection.
       * `lastSeq` is only meaningful within that epoch: if it differs from the server's current epoch
       * (the server restarted), the server answers `resync_required` instead of a replay.
       */
      epoch: string | null;
    }
  | { type: 'pong'; ts: number };

export type ServerMessage =
  | {
      type: 'welcome';
      serverSeq: number;
      heartbeatMs: number;
      /**
       * Random id generated when the server starts. A new value means the server's state and its
       * `seq` counter were reset, so earlier `seq` values cannot be resumed from.
       */
      epoch: string;
    }
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
