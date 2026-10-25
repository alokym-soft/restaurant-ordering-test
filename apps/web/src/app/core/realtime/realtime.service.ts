import { DOCUMENT, DestroyRef, Injectable, inject } from '@angular/core';
import { BehaviorSubject, Subject, distinctUntilChanged, type Observable, type Unsubscribable } from 'rxjs';
import {
  WS_CLOSE,
  type ClientMessage,
  type ServerEvent,
  type ServerEventType,
  type ServerMessage,
} from '@restaurant/contracts';
import { fullJitterDelay } from './backoff';
import {
  REALTIME_CONFIG,
  REALTIME_RANDOM,
  REALTIME_SOCKET_FACTORY,
  type RealtimeSocket,
} from './realtime.config';

/**
 * - `connecting`: first connection attempt.
 * - `online`: `welcome` received; events flow.
 * - `reconnecting`: waiting for the next attempt (see `attempt`).
 * - `offline`: the browser reports no network; waiting for the `online` event.
 * - `error`: the server rejected our protocol (close 4400); not retried automatically.
 */
export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting' | 'offline' | 'error';

export interface RealtimeState {
  status: ConnectionStatus;
  /** Number of consecutive failed attempts; 0 once `welcome` arrives. */
  attempt: number;
  lastSeq: number | null;
}

export interface ResyncRequired {
  serverSeq: number;
  oldestAvailableSeq: number;
}

/**
 * The single WebSocket of the app. Implements the protocol from `@restaurant/contracts`
 * (`realtime.ts`): `hello { lastSeq }` → `welcome` → replay or `resync_required` → live events,
 * `ping`/`pong`, reconnect with full-jitter backoff, and heartbeat-based dead-connection detection.
 * Domains consume `events$`; they never touch the socket.
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private readonly config = inject(REALTIME_CONFIG);
  private readonly socketFactory = inject(REALTIME_SOCKET_FACTORY);
  private readonly random = inject(REALTIME_RANDOM);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly document = inject(DOCUMENT);

  private readonly stateSubject = new BehaviorSubject<RealtimeState>({
    status: 'connecting',
    attempt: 0,
    lastSeq: null,
  });
  private readonly eventsSubject = new Subject<ServerEvent>();
  private readonly resyncSubject = new Subject<ResyncRequired>();
  private readonly streamStartSubject = new BehaviorSubject<number | null>(null);

  /** Connection state; emits on every change. */
  readonly state$: Observable<RealtimeState> = this.stateSubject.pipe(
    distinctUntilChanged(
      (a, b) => a.status === b.status && a.attempt === b.attempt && a.lastSeq === b.lastSeq,
    ),
  );
  /** Server events in `seq` order, without duplicates. Hot; shared by all subscribers. */
  readonly events$: Observable<ServerEvent> = this.eventsSubject.asObservable();
  /** The server could not replay missed events; snapshots must be refetched. */
  readonly resyncRequired$: Observable<ResyncRequired> = this.resyncSubject.asObservable();
  /**
   * The `seq` after which `events$` is complete: every later event is (or will be) delivered.
   * A snapshot older than this is missing events that will never arrive and must be reloaded.
   * Null until the first `welcome`. Replays the current value to new subscribers.
   */
  readonly streamStart$: Observable<number | null> = this.streamStartSubject.pipe(distinctUntilChanged());

  private socket: RealtimeSocket | null = null;
  private subscription: Unsubscribable | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private livenessTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatMs: number | null = null;
  private lastSeq: number | null = null;
  /** Server epoch that `lastSeq` belongs to; sent back in `hello`. */
  private epoch: string | null = null;
  private attempt = 0;
  private started = false;
  private hiddenSince: number | null = null;
  private readonly cleanups: (() => void)[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  get state(): RealtimeState {
    return this.stateSubject.value;
  }

  /** Opens the connection and starts listening to browser network and visibility events. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.listenToBrowser();
    if (this.isBrowserOffline()) {
      this.setState('offline');
      return;
    }
    this.open();
  }

  /** Closes the connection and stops reconnecting. */
  stop(): void {
    this.started = false;
    this.clearTimers();
    this.closeSocket();
    this.cleanups.splice(0).forEach((cleanup) => cleanup());
  }

  /** Connect now instead of waiting for the backoff timer. No-op while online or in `error`. */
  reconnectNow(): void {
    const { status } = this.state;
    if (!this.started || status === 'online' || status === 'error') return;
    if (this.socket && status === 'connecting') return;
    this.clearReconnectTimer();
    this.closeSocket();
    this.open();
  }

  private open(): void {
    this.clearReconnectTimer();
    this.heartbeatMs = null;
    this.setState(this.attempt === 0 ? 'connecting' : 'reconnecting');

    const socket = this.socketFactory({
      url: this.config.url,
      serializer: (message) => JSON.stringify(message),
      // Parse ourselves so that one malformed frame does not error the whole stream.
      deserializer: (event) => event.data as unknown,
      openObserver: {
        next: () => {
          if (this.socket !== socket) return;
          this.send({ type: 'hello', lastSeq: this.lastSeq, epoch: this.epoch });
          this.armLiveness();
        },
      },
      closeObserver: {
        next: (event) => this.onClosed(socket, event.code),
      },
    });

    this.socket = socket;
    this.subscription = socket.subscribe({
      next: (raw) => {
        if (this.socket === socket) this.onFrame(raw);
      },
      error: () => this.onClosed(socket, null),
      complete: () => this.onClosed(socket, null),
    });
  }

  private onFrame(raw: unknown): void {
    const message = parseServerMessage(raw);
    if (!message) {
      console.warn('[realtime] ignored malformed frame');
      return;
    }
    // Any frame proves the connection is alive.
    this.armLiveness();

    switch (message.type) {
      case 'welcome':
        this.heartbeatMs = message.heartbeatMs;
        this.epoch = message.epoch;
        this.attempt = 0;
        // First connection: start resume tracking from the server's current position.
        if (this.lastSeq === null) {
          this.lastSeq = message.serverSeq;
          this.streamStartSubject.next(message.serverSeq);
        }
        this.armLiveness();
        this.setState('online');
        break;
      case 'ping':
        this.send({ type: 'pong', ts: message.ts });
        break;
      case 'event': {
        const { event } = message;
        if (this.lastSeq !== null && event.seq <= this.lastSeq) return; // duplicate
        // After welcome (and any replay) seq must be consecutive; anything else means lost events.
        const gap = this.lastSeq !== null && event.seq !== this.lastSeq + 1;
        this.lastSeq = event.seq;
        if (gap) {
          console.warn(`[realtime] gap in the event stream before seq ${event.seq}; resyncing`);
          this.setState(this.state.status);
          // Set before the resync so restarted snapshot flows already see the new start.
          this.streamStartSubject.next(event.seq - 1);
          this.resyncSubject.next({ serverSeq: event.seq, oldestAvailableSeq: event.seq });
        }
        if (!isKnownEventType(event.type)) {
          // Keeps seq tracking intact (no false gap), but never hands an unknown shape to a reducer.
          console.warn(`[realtime] ignored event of unknown type "${String(event.type)}"`);
          this.setState(this.state.status);
          return;
        }
        this.eventsSubject.next(event);
        this.setState(this.state.status);
        break;
      }
      case 'resync_required':
        this.lastSeq = message.serverSeq;
        this.setState(this.state.status);
        this.streamStartSubject.next(message.serverSeq);
        this.resyncSubject.next({
          serverSeq: message.serverSeq,
          oldestAvailableSeq: message.oldestAvailableSeq,
        });
        break;
    }
  }

  private onClosed(socket: RealtimeSocket, code: number | null): void {
    if (this.socket !== socket) return; // already handled, or a socket we closed on purpose
    this.socket = null;
    this.subscription = null;
    this.clearLivenessTimer();
    if (!this.started) return;

    if (code === WS_CLOSE.PROTOCOL_ERROR) {
      console.error('[realtime] the server rejected the protocol (4400); not reconnecting');
      this.setState('error');
      return;
    }
    if (this.isBrowserOffline()) {
      this.setState('offline');
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();
    const delay = fullJitterDelay(this.attempt, this.random, this.config.backoff);
    this.attempt += 1;
    this.setState('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  /** Treat the connection as dead if nothing arrives in time (half-open sockets). */
  private armLiveness(): void {
    this.clearLivenessTimer();
    const timeoutMs =
      this.heartbeatMs === null
        ? this.config.handshakeTimeoutMs
        : this.heartbeatMs * this.config.missedHeartbeats;
    this.livenessTimer = setTimeout(() => {
      this.livenessTimer = null;
      const socket = this.socket;
      if (!socket) return;
      console.warn('[realtime] heartbeat timeout; reconnecting');
      this.closeSocket();
      this.onClosedAfterTimeout();
    }, timeoutMs);
  }

  private onClosedAfterTimeout(): void {
    if (!this.started) return;
    if (this.isBrowserOffline()) {
      this.setState('offline');
      return;
    }
    this.scheduleReconnect();
  }

  private send(message: ClientMessage): void {
    this.socket?.next(message);
  }

  /** Closes the current socket without triggering the close handling. */
  private closeSocket(): void {
    const subscription = this.subscription;
    this.socket = null;
    this.subscription = null;
    this.clearLivenessTimer();
    subscription?.unsubscribe();
  }

  private listenToBrowser(): void {
    const win = this.window;
    if (!win) return;

    const onOnline = (): void => {
      if (this.state.status === 'offline') this.attempt = 0;
      this.reconnectNow();
    };
    const onOffline = (): void => {
      this.clearReconnectTimer();
      this.closeSocket();
      this.setState('offline');
    };
    const onVisibility = (): void => {
      if (this.document.visibilityState === 'hidden') {
        this.hiddenSince = Date.now();
        return;
      }
      if (this.hiddenSince === null) return;
      this.hiddenSince = null;
      this.reconnectNow();
    };

    win.addEventListener('online', onOnline);
    win.addEventListener('offline', onOffline);
    this.document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(
      () => win.removeEventListener('online', onOnline),
      () => win.removeEventListener('offline', onOffline),
      () => this.document.removeEventListener('visibilitychange', onVisibility),
    );
  }

  private isBrowserOffline(): boolean {
    return this.window?.navigator.onLine === false;
  }

  private setState(status: ConnectionStatus): void {
    this.stateSubject.next({ status, attempt: this.attempt, lastSeq: this.lastSeq });
  }

  private clearTimers(): void {
    this.clearReconnectTimer();
    this.clearLivenessTimer();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearLivenessTimer(): void {
    if (this.livenessTimer !== null) clearTimeout(this.livenessTimer);
    this.livenessTimer = null;
  }
}

/** Every event type of the contract; the `Record` type fails to compile if one is missing. */
const KNOWN_EVENT_TYPES: Record<ServerEventType, true> = {
  'menu.category.upserted': true,
  'menu.category.removed': true,
  'menu.item.upserted': true,
  'menu.item.removed': true,
  'order.created': true,
  'order.status.changed': true,
};

function isKnownEventType(type: unknown): type is ServerEventType {
  return typeof type === 'string' && Object.hasOwn(KNOWN_EVENT_TYPES, type);
}

/** Minimal structural check of an incoming frame; the payload contract is trusted. */
export function parseServerMessage(raw: unknown): ServerMessage | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof value !== 'object' || value === null) return null;
  const message = value as Record<string, unknown>;
  switch (message['type']) {
    case 'welcome':
      return typeof message['serverSeq'] === 'number' &&
        typeof message['heartbeatMs'] === 'number' &&
        typeof message['epoch'] === 'string'
        ? (message as unknown as ServerMessage)
        : null;
    case 'ping':
      return typeof message['ts'] === 'number' ? (message as unknown as ServerMessage) : null;
    case 'event': {
      const event = message['event'] as Record<string, unknown> | null | undefined;
      return typeof event === 'object' && event !== null && Number.isSafeInteger(event['seq'])
        ? (message as unknown as ServerMessage)
        : null;
    }
    case 'resync_required':
      return typeof message['serverSeq'] === 'number' ? (message as unknown as ServerMessage) : null;
    default:
      return null;
  }
}
