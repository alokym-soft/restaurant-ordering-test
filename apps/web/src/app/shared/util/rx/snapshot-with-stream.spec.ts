import { Subject, type Observable } from 'rxjs';
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
