import { TestBed } from '@angular/core/testing';
import type { Observer } from 'rxjs';
import type { WebSocketSubjectConfig } from 'rxjs/webSocket';
import type { ClientMessage, ServerEvent, ServerMessage } from '@restaurant/contracts';
import {
  REALTIME_CONFIG,
  REALTIME_RANDOM,
  REALTIME_SOCKET_FACTORY,
  type RealtimeConfig,
  type RealtimeSocket,
} from './realtime.config';
import { RealtimeService, type RealtimeState, parseServerMessage } from './realtime.service';

class FakeSocket implements RealtimeSocket {
  readonly sent: ClientMessage[] = [];
  closed = false;
  private observer: Partial<Observer<unknown>> | null = null;

  constructor(readonly config: WebSocketSubjectConfig<unknown>) {}

  subscribe(observer: Partial<Observer<unknown>>) {
    this.observer = observer;
    return { unsubscribe: () => (this.closed = true) };
  }

  next(message: unknown): void {
    this.sent.push(message as ClientMessage);
  }

  complete(): void {
    this.closed = true;
  }

  /** Server side helpers. */
  open(): void {
    this.config.openObserver?.next(new Event('open'));
  }

  receive(message: ServerMessage | string): void {
    this.observer?.next?.(typeof message === 'string' ? message : JSON.stringify(message));
  }

  serverClose(code: number): void {
    this.config.closeObserver?.next({ code, wasClean: true } as CloseEvent);
    this.observer?.complete?.();
  }
}

const CONFIG: RealtimeConfig = {
  url: 'ws://test/api/ws',
  backoff: { baseMs: 500, capMs: 15_000 },
  handshakeTimeoutMs: 5_000,
  missedHeartbeats: 3,
};

function event(seq: number): ServerEvent {
  return {
    seq,
    type: 'menu.category.removed',
    at: '2026-01-01T00:00:00.000Z',
    payload: { id: `c${seq}` },
  };
}

describe('RealtimeService', () => {
  let sockets: FakeSocket[];
  let service: RealtimeService;
  let states: RealtimeState[];
  let random: number;

  const last = (): FakeSocket => {
    const socket = sockets.at(-1);
    if (!socket) throw new Error('no socket was opened');
    return socket;
  };

  const connect = (serverSeq = 10, heartbeatMs = 1_000, epoch = 'e1'): FakeSocket => {
    const socket = last();
    socket.open();
    socket.receive({ type: 'welcome', serverSeq, heartbeatMs, epoch });
    return socket;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    random = 0.5;
    TestBed.configureTestingModule({
      providers: [
        { provide: REALTIME_CONFIG, useValue: CONFIG },
        { provide: REALTIME_RANDOM, useValue: () => random },
        {
          provide: REALTIME_SOCKET_FACTORY,
          useValue: (config: WebSocketSubjectConfig<unknown>) => {
            const socket = new FakeSocket(config);
            sockets.push(socket);
            return socket;
          },
        },
      ],
    });
    service = TestBed.inject(RealtimeService);
    states = [];
    service.state$.subscribe((state) => states.push(state));
  });

  afterEach(() => {
    service.stop();
    vi.useRealTimers();
  });

  it('sends hello with null lastSeq first, then goes online on welcome', () => {
    service.start();
    expect(service.state.status).toBe('connecting');
    const socket = last();
    socket.open();
    expect(socket.sent).toEqual([{ type: 'hello', lastSeq: null, epoch: null }]);

    socket.receive({ type: 'welcome', serverSeq: 42, heartbeatMs: 1_000, epoch: 'e1' });
    expect(service.state).toEqual({ status: 'online', attempt: 0, lastSeq: 42 });
  });

  it('answers ping with pong', () => {
    service.start();
    const socket = connect();
    socket.receive({ type: 'ping', ts: 123 });
    expect(socket.sent.at(-1)).toEqual({ type: 'pong', ts: 123 });
  });

  it('emits events in order, drops duplicates and resumes with the last seq', () => {
    const received: number[] = [];
    service.events$.subscribe((e) => received.push(e.seq));
    service.start();
    const socket = connect(10);

    for (const seq of [11, 12, 12, 11, 13]) socket.receive({ type: 'event', event: event(seq) });
    expect(received).toEqual([11, 12, 13]);

    socket.serverClose(1006);
    vi.advanceTimersByTime(CONFIG.backoff.baseMs);
    const next = last();
    expect(next).not.toBe(socket);
    next.open();
    expect(next.sent[0]).toEqual({ type: 'hello', lastSeq: 13, epoch: 'e1' });
  });

  it('reconnects with exponential backoff and full jitter, reset after welcome', () => {
    random = 0.5;
    service.start();
    connect();

    // attempt 0: 0.5 * 500 = 250 ms
    last().serverClose(1006);
    expect(service.state).toMatchObject({ status: 'reconnecting', attempt: 1 });
    vi.advanceTimersByTime(249);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);

    // attempt 1 fails before opening: 0.5 * 1000 = 500 ms
    last().serverClose(1006);
    expect(service.state.attempt).toBe(2);
    vi.advanceTimersByTime(499);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);

    // welcome resets the backoff
    connect();
    expect(service.state).toMatchObject({ status: 'online', attempt: 0 });
    last().serverClose(1006);
    vi.advanceTimersByTime(250);
    expect(sockets).toHaveLength(4);
  });

  it('caps the backoff delay', () => {
    random = 0.999;
    service.start();
    for (let i = 0; i < 12; i++) {
      last().serverClose(1006);
      vi.advanceTimersByTime(15_000);
    }
    expect(sockets).toHaveLength(13);
  });

  it('treats 3 missed heartbeats as a dead connection', () => {
    service.start();
    const socket = connect(10, 1_000);

    vi.advanceTimersByTime(2_999);
    expect(socket.closed).toBe(false);
    socket.receive({ type: 'ping', ts: 1 }); // any frame resets the timer
    vi.advanceTimersByTime(2_999);
    expect(socket.closed).toBe(false);

    vi.advanceTimersByTime(1);
    expect(socket.closed).toBe(true);
    expect(service.state.status).toBe('reconnecting');
    vi.advanceTimersByTime(250);
    expect(sockets).toHaveLength(2);
  });

  it('times out a handshake that never gets a welcome', () => {
    service.start();
    const socket = last();
    socket.open();
    vi.advanceTimersByTime(CONFIG.handshakeTimeoutMs);
    expect(socket.closed).toBe(true);
    expect(service.state.status).toBe('reconnecting');
  });

  it('does not retry after a protocol error (4400)', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.start();
    connect();
    last().serverClose(4400);
    expect(service.state.status).toBe('error');
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
    expect(error).toHaveBeenCalled();
  });

  it('emits resync_required and resumes from the server position', () => {
    const resyncs: number[] = [];
    service.resyncRequired$.subscribe((r) => resyncs.push(r.serverSeq));
    service.start();
    const socket = connect(10);
    socket.receive({ type: 'resync_required', oldestAvailableSeq: 50, serverSeq: 80 });
    expect(resyncs).toEqual([80]);
    expect(service.state.lastSeq).toBe(80);
  });

  it('goes offline on the browser offline event and reconnects immediately when online', () => {
    service.start();
    const socket = connect();

    window.dispatchEvent(new Event('offline'));
    expect(service.state.status).toBe('offline');
    expect(socket.closed).toBe(true);

    window.dispatchEvent(new Event('online'));
    expect(sockets).toHaveLength(2);
    expect(service.state.status).toBe('connecting');
  });

  it('reconnects immediately when a hidden tab becomes visible', () => {
    let visibility: DocumentVisibilityState = 'visible';
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
    service.start();
    connect();
    last().serverClose(1006);
    random = 0.999; // long backoff
    expect(service.state.status).toBe('reconnecting');

    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    visibility = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sockets).toHaveLength(2);
  });

  it('ignores malformed frames', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    service.start();
    const socket = connect();
    socket.receive('not json');
    socket.receive(JSON.stringify({ type: 'event' }));
    expect(service.state.status).toBe('online');
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it('publishes state changes', () => {
    service.start();
    connect();
    expect(states.map((s) => s.status)).toEqual(['connecting', 'online']);
  });
});

describe('parseServerMessage', () => {
  it('accepts valid frames and rejects invalid ones', () => {
    expect(parseServerMessage('{"type":"ping","ts":1}')).toEqual({ type: 'ping', ts: 1 });
    expect(parseServerMessage('{"type":"ping"}')).toBeNull();
    expect(parseServerMessage('{"type":"unknown"}')).toBeNull();
    expect(parseServerMessage('{')).toBeNull();
  });
});
