import { BehaviorSubject, Subject, defer, type Observable } from 'rxjs';
import { type SnapshotWithStream, snapshotWithStream } from './snapshot-with-stream';

interface Snap {
  seq: number;
  name: string;
}
interface Ev {
  seq: number;
}

function record<S, E>(source: Observable<SnapshotWithStream<S, E>>) {
  const out: SnapshotWithStream<S, E>[] = [];
  let error: unknown = null;
  source.subscribe({ next: (v) => out.push(v), error: (e: unknown) => (error = e) });
  return { out, error: () => error };
}

describe('snapshotWithStream', () => {
  let snapshot$: Subject<Snap>;
  let events$: Subject<Ev>;

  beforeEach(() => {
    snapshot$ = new Subject<Snap>();
    events$ = new Subject<Ev>();
  });

  it('buffers events during the snapshot load and applies only newer ones after it', () => {
    const { out } = record(snapshotWithStream(snapshot$, events$));
    events$.next({ seq: 4 });
    events$.next({ seq: 5 });
    events$.next({ seq: 6 });
    expect(out).toEqual([]);

    snapshot$.next({ seq: 5, name: 's' });
    expect(out).toEqual([
      { kind: 'snapshot', snapshot: { seq: 5, name: 's' } },
      { kind: 'events', events: [{ seq: 6 }] },
    ]);
  });

  it('passes newer live events through and drops older ones after the snapshot', () => {
    const { out } = record(snapshotWithStream(snapshot$, events$));
    snapshot$.next({ seq: 10, name: 's' });
    events$.next({ seq: 9 });
    events$.next({ seq: 10 });
    events$.next({ seq: 11 });
    expect(out).toEqual([
      { kind: 'snapshot', snapshot: { seq: 10, name: 's' } },
      { kind: 'events', events: [{ seq: 11 }] },
    ]);
  });

  it('emits no event batch when every buffered event is already in the snapshot', () => {
    const { out } = record(snapshotWithStream(snapshot$, events$));
    events$.next({ seq: 3 });
    snapshot$.next({ seq: 3, name: 's' });
    expect(out).toEqual([{ kind: 'snapshot', snapshot: { seq: 3, name: 's' } }]);
  });

  it('propagates snapshot errors', () => {
    const { error } = record(snapshotWithStream(snapshot$, events$));
    snapshot$.error(new Error('boom'));
    expect(error()).toBeInstanceOf(Error);
  });

  describe('with a stream start', () => {
    let streamStart$: BehaviorSubject<number | null>;
    let requests: number;
    let counted$: Observable<Snap>;

    beforeEach(() => {
      streamStart$ = new BehaviorSubject<number | null>(null);
      requests = 0;
      counted$ = defer(() => {
        requests += 1;
        return snapshot$;
      });
    });

    it('reloads a snapshot older than the stream start instead of applying it', () => {
      streamStart$.next(7); // welcome.serverSeq = 7 arrived first
      const { out } = record(snapshotWithStream(counted$, events$, streamStart$));
      events$.next({ seq: 8 });
      snapshot$.next({ seq: 5, name: 'stale' }); // 6 and 7 were never received

      expect(out).toEqual([]);
      expect(requests).toBe(2);

      snapshot$.next({ seq: 7, name: 'fresh' });
      expect(out).toEqual([
        { kind: 'snapshot', snapshot: { seq: 7, name: 'fresh' } },
        { kind: 'events', events: [{ seq: 8 }] },
      ]);
    });

    it('reloads when the socket connects after an older snapshot was applied (request started first)', () => {
      const { out } = record(snapshotWithStream(counted$, events$, streamStart$));
      snapshot$.next({ seq: 5, name: 'early' }); // socket not connected yet
      expect(out).toEqual([{ kind: 'snapshot', snapshot: { seq: 5, name: 'early' } }]);

      streamStart$.next(7); // welcome.serverSeq = 7: events 6..7 will never arrive
      expect(requests).toBe(2);
      events$.next({ seq: 8 });
      expect(out).toHaveLength(1); // buffered until the reloaded snapshot

      snapshot$.next({ seq: 7, name: 'reloaded' });
      expect(out.slice(1)).toEqual([
        { kind: 'snapshot', snapshot: { seq: 7, name: 'reloaded' } },
        { kind: 'events', events: [{ seq: 8 }] },
      ]);
    });

    it('keeps a snapshot that is at or after the stream start', () => {
      streamStart$.next(7);
      const { out } = record(snapshotWithStream(counted$, events$, streamStart$));
      snapshot$.next({ seq: 7, name: 's' });
      streamStart$.next(7);
      expect(requests).toBe(1);
      expect(out).toEqual([{ kind: 'snapshot', snapshot: { seq: 7, name: 's' } }]);
    });
  });

  it('starts fresh on every subscription (resync)', () => {
    const source = snapshotWithStream(snapshot$, events$);
    const first = record(source);
    snapshot$.next({ seq: 1, name: 'a' });
    const second = record(source);
    events$.next({ seq: 2 });
    expect(first.out.at(-1)).toEqual({ kind: 'events', events: [{ seq: 2 }] });
    expect(second.out).toEqual([]);
    snapshot$.next({ seq: 2, name: 'b' });
    expect(second.out).toEqual([{ kind: 'snapshot', snapshot: { seq: 2, name: 'b' } }]);
  });
});
