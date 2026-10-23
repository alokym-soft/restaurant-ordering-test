import type { ServerEvent } from '@restaurant/contracts';

/** An event before the bus stamps it with `seq` and `at`. */
export type UnstampedEvent = ServerEvent extends infer E
  ? E extends ServerEvent
    ? Omit<E, 'seq' | 'at'>
    : never
  : never;

export type EventListener = (event: ServerEvent) => void;

/**
 * Global, strictly increasing `seq` for every state change, plus a bounded buffer of recent
 * events so reconnecting clients can resume. Publishing is synchronous: a snapshot taken right
 * after a mutation always carries the `seq` of that mutation's event.
 */
export class EventBus {
  private seq = 0;
  private readonly buffer: ServerEvent[] = [];
  private readonly listeners = new Set<EventListener>();

  constructor(
    private readonly capacity: number,
    private readonly now: () => Date = () => new Date(),
    private readonly onListenerError: (error: unknown) => void = () => undefined,
  ) {}

  get currentSeq(): number {
    return this.seq;
  }

  /** The oldest `seq` still replayable; `currentSeq + 1` when the buffer is empty. */
  get oldestAvailableSeq(): number {
    return this.buffer[0]?.seq ?? this.seq + 1;
  }

  publish(event: UnstampedEvent): ServerEvent {
    this.seq += 1;
    const stamped = { ...event, seq: this.seq, at: this.now().toISOString() } as ServerEvent;
    this.buffer.push(stamped);
    if (this.buffer.length > this.capacity) this.buffer.shift();
    for (const listener of this.listeners) {
      // One failing listener (for example a broken socket) must not affect the others.
      try {
        listener(stamped);
      } catch (error) {
        this.onListenerError(error);
      }
    }
    return stamped;
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Events after `lastSeq`, or `null` if they can no longer be replayed: either they fell out of
   * the buffer, or `lastSeq` is ahead of the server (the server restarted and lost its history).
   */
  since(lastSeq: number): ServerEvent[] | null {
    if (lastSeq > this.seq) return null;
    if (lastSeq === this.seq) return [];
    if (lastSeq + 1 < this.oldestAvailableSeq) return null;
    return this.buffer.filter((event) => event.seq > lastSeq);
  }
}
