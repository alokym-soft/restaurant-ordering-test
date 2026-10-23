import { InjectionToken, inject, DOCUMENT } from '@angular/core';
import { type Observer, type Unsubscribable } from 'rxjs';
import { webSocket, type WebSocketSubjectConfig } from 'rxjs/webSocket';
import { API } from '@restaurant/contracts';
import { type BackoffOptions, DEFAULT_BACKOFF } from './backoff';

/** The part of `WebSocketSubject` the realtime service relies on; easy to fake in tests. */
export interface RealtimeSocket {
  subscribe(observer: Partial<Observer<unknown>>): Unsubscribable;
  next(message: unknown): void;
  complete(): void;
}

export type RealtimeSocketFactory = (config: WebSocketSubjectConfig<unknown>) => RealtimeSocket;

export interface RealtimeConfig {
  url: string;
  backoff: BackoffOptions;
  /** How long to wait for `welcome` after opening, before the server's interval is known. */
  handshakeTimeoutMs: number;
  /** Silence longer than `heartbeatMs * missedHeartbeats` means the connection is dead. */
  missedHeartbeats: number;
}

export const REALTIME_CONFIG = new InjectionToken<RealtimeConfig>('REALTIME_CONFIG', {
  factory: () => {
    const location = inject(DOCUMENT).location;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    return {
      url: `${protocol}//${location.host}${API.ws}`,
      backoff: DEFAULT_BACKOFF,
      handshakeTimeoutMs: 10_000,
      missedHeartbeats: 3,
    };
  },
});

export const REALTIME_SOCKET_FACTORY = new InjectionToken<RealtimeSocketFactory>('REALTIME_SOCKET_FACTORY', {
  factory: () => (config) => webSocket<unknown>(config),
});

/** Source of randomness for backoff jitter. */
export const REALTIME_RANDOM = new InjectionToken<() => number>('REALTIME_RANDOM', {
  factory: () => Math.random,
});
