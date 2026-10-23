import { EMPTY, type Observable, concatMap, defer, map, merge, of, take } from 'rxjs';

export interface Sequenced {
  seq: number;
}

export type SnapshotWithStream<S, E> =
  | { kind: 'snapshot'; snapshot: S }
  | { kind: 'events'; events: E[] };

/**
 * Combines a snapshot request with a live event stream so that nothing is lost or applied twice,
 * whatever order the snapshot response and the events arrive in.
 *
 * Subscribes to `events$` first and buffers events until the snapshot arrives; then emits the
 * snapshot, then the buffered events newer than `snapshot.seq` as one batch, then every newer
 * live event. Events with `seq <= snapshot.seq` are already part of the snapshot and are dropped.
 * Errors of `snapshot$` propagate.
 */
export function snapshotWithStream<S extends Sequenced, E extends Sequenced>(
  snapshot$: Observable<S>,
  events$: Observable<E>,
): Observable<SnapshotWithStream<S, E>> {
  return defer(() => {
    const buffer: E[] = [];
    let snapshotSeq: number | null = null;

    type Input = { kind: 'event'; event: E } | { kind: 'snapshot'; snapshot: S };

    const input$: Observable<Input> = merge(
      events$.pipe(map((event): Input => ({ kind: 'event', event }))),
      snapshot$.pipe(
        take(1),
        map((snapshot): Input => ({ kind: 'snapshot', snapshot })),
      ),
    );

    return input$.pipe(
      concatMap((input): Observable<SnapshotWithStream<S, E>> => {
        if (input.kind === 'snapshot') {
          const seq = input.snapshot.seq;
          snapshotSeq = seq;
          const pending = buffer.splice(0).filter((event) => event.seq > seq);
          const snapshot: SnapshotWithStream<S, E> = { kind: 'snapshot', snapshot: input.snapshot };
          if (pending.length === 0) return of(snapshot);
          const batch: SnapshotWithStream<S, E> = { kind: 'events', events: pending };
          return of(snapshot, batch);
        }
        if (snapshotSeq === null) {
          buffer.push(input.event);
          return EMPTY;
        }
        if (input.event.seq <= snapshotSeq) return EMPTY;
        const live: SnapshotWithStream<S, E> = { kind: 'events', events: [input.event] };
        return of(live);
      }),
    );
  });
}
