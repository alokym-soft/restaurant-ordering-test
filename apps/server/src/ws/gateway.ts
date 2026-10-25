import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { API, WS_CLOSE, type ClientMessage, type ServerMessage } from '@restaurant/contracts';

/** A client that does not say `hello` in time is not speaking our protocol. */
const HELLO_TIMEOUT_MS = 5_000;
/** Above this many queued bytes a client is considered too slow and is dropped. */
const MAX_BUFFERED_BYTES = 1_000_000;
const CLOSE_TRY_AGAIN_LATER = 1013;
const CLOSE_SERVICE_RESTART = 1012;
const MISSED_HEARTBEATS = 3;

function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const message = value as Record<string, unknown>;
  if (message['type'] === 'hello') {
    const lastSeq = message['lastSeq'];
    const epoch = message['epoch'];
    const validSeq = lastSeq === null || (Number.isSafeInteger(lastSeq) && (lastSeq as number) >= 0);
    const validEpoch = epoch === null || (typeof epoch === 'string' && epoch.length > 0 && epoch.length <= 100);
    return validSeq && validEpoch
      ? { type: 'hello', lastSeq: lastSeq as number | null, epoch: epoch as string | null }
      : null;
  }
  if (message['type'] === 'pong' && typeof message['ts'] === 'number') {
    return { type: 'pong', ts: message['ts'] };
  }
  return null;
}

/**
 * WebSocket endpoint implementing the protocol in `@restaurant/contracts` (realtime.ts):
 * `hello` → `welcome` → replay or `resync_required` → live events, with ping/pong heartbeat.
 */
export async function realtimeGateway(app: FastifyInstance): Promise<void> {
  const { bus, epoch } = app.services;
  const { heartbeatMs, wsDropMs } = app.config;
  const sockets = new Set<WebSocket>();

  let dropTimer: ReturnType<typeof setInterval> | null = null;
  if (wsDropMs !== null) {
    // Fault injection: drop every connection periodically to demonstrate reconnect and resume.
    dropTimer = setInterval(() => {
      for (const socket of sockets) socket.close(CLOSE_SERVICE_RESTART, 'Simulated drop');
    }, wsDropMs);
    dropTimer.unref();
  }

  app.addHook('onClose', async () => {
    if (dropTimer) clearInterval(dropTimer);
    for (const socket of sockets) socket.close(WS_CLOSE.GOING_AWAY, 'Server shutting down');
  });

  app.get(API.ws, { websocket: true }, (socket, request) => {
    const log = request.log;
    sockets.add(socket);

    let unsubscribe: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let lastSeenAt = Date.now();

    const send = (message: ServerMessage): void => {
      if (socket.readyState !== socket.OPEN) return;
      if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
        log.warn('closing slow websocket client');
        socket.close(CLOSE_TRY_AGAIN_LATER, 'Client too slow');
        return;
      }
      socket.send(JSON.stringify(message));
    };

    const protocolError = (reason: string): void => {
      log.info({ reason }, 'websocket protocol error');
      socket.close(WS_CLOSE.PROTOCOL_ERROR, reason);
    };

    const helloTimer = setTimeout(() => protocolError('Expected hello'), HELLO_TIMEOUT_MS);
    helloTimer.unref();

    const startSession = (lastSeq: number | null, clientEpoch: string | null): void => {
      clearTimeout(helloTimer);
      send({ type: 'welcome', serverSeq: bus.currentSeq, heartbeatMs, epoch });

      // Replay and subscription happen in the same tick: no event can slip in between.
      if (lastSeq !== null) {
        // A different epoch means the client's seq belongs to an earlier server run: never replay
        // events from this run against it. `since` also refuses a lastSeq ahead of the server.
        const sameEpoch = clientEpoch === null || clientEpoch === epoch;
        const missed = sameEpoch ? bus.since(lastSeq) : null;
        if (missed === null) {
          send({ type: 'resync_required', oldestAvailableSeq: bus.oldestAvailableSeq, serverSeq: bus.currentSeq });
        } else {
          for (const event of missed) send({ type: 'event', event });
        }
      }
      unsubscribe = bus.subscribe((event) => send({ type: 'event', event }));

      heartbeat = setInterval(() => {
        if (Date.now() - lastSeenAt > heartbeatMs * MISSED_HEARTBEATS) {
          log.info('websocket heartbeat timeout');
          socket.close(WS_CLOSE.HEARTBEAT_TIMEOUT, 'Heartbeat timeout');
          return;
        }
        send({ type: 'ping', ts: Date.now() });
      }, heartbeatMs);
      heartbeat.unref();
    };

    socket.on('message', (data, isBinary) => {
      lastSeenAt = Date.now();
      const message = isBinary ? null : parseClientMessage(data.toString());
      if (!message) return protocolError('Malformed message');

      if (message.type === 'hello') {
        if (unsubscribe) return protocolError('Duplicate hello');
        return startSession(message.lastSeq, message.epoch);
      }
      if (!unsubscribe) return protocolError('Expected hello');
      // pong: lastSeenAt is already updated.
    });

    socket.on('close', () => {
      clearTimeout(helloTimer);
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe?.();
      sockets.delete(socket);
    });

    socket.on('error', (error) => log.warn({ err: error }, 'websocket error'));
  });
}
