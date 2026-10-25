import {
  BehaviorSubject,
  EMPTY,
  type Observable,
  concatMap,
  defer,
  map,
  merge,
  of,
  switchMap,
  take,
} from 'rxjs';

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
 *
 * `streamStart$` is the `seq` after which `events$` is complete (the `serverSeq` of the `welcome`
 * that started the stream). A snapshot older than it misses events that will never arrive, so it
 * is requested again: before it is applied if the start is already known, or after it was applied
 * if the socket connected later (the request started before the socket). Events keep buffering
 * until the newer snapshot arrives. `snapshot$` must be cold: every subscription is a new request.
 * Errors of `snapshot$` propagate.
 */
export function snapshotWithStream<S extends Sequenced, E extends Sequenced>(
  snapshot$: Observable<S>,
  events$: Observable<E>,
  streamStart$: Observable<number | null> = EMPTY,
): Observable<SnapshotWithStream<S, E>> {
  return defer(() => {
    const buffer: E[] = [];
    let snapshotSeq: number | null = null;
    let streamStart: number | null = null;
    const requests = new BehaviorSubject<void>(undefined);

    type Input =
      | { kind: 'event'; event: E }
      | { kind: 'snapshot'; snapshot: S }
      | { kind: 'start'; seq: number | null };

    const input$: Observable<Input> = merge(
      streamStart$.pipe(map((seq): Input => ({ kind: 'start', seq }))),
      events$.pipe(map((event): Input => ({ kind: 'event', event }))),
      requests.pipe(
        switchMap(() => snapshot$.pipe(take(1))),
        map((snapshot): Input => ({ kind: 'snapshot', snapshot })),
      ),
    );

    const reload = (): void => {
      snapshotSeq = null; // buffer events again until the newer snapshot
      requests.next();
    };

    return input$.pipe(
      concatMap((input): Observable<SnapshotWithStream<S, E>> => {
        if (input.kind === 'start') {
          streamStart = input.seq;
          if (snapshotSeq !== null && streamStart !== null && snapshotSeq < streamStart) reload();
          return EMPTY;
        }
        if (input.kind === 'snapshot') {
          const seq = input.snapshot.seq;
          if (streamStart !== null && seq < streamStart) {
            reload();
            return EMPTY;
          }
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
