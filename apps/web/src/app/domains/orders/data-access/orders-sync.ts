import type { Action } from '@ngrx/store';
import { type Observable, type SchedulerLike, catchError, concat, connect, filter, map, merge, of } from 'rxjs';
import type { OrderEvent, OrdersSnapshot, ServerEvent } from '@restaurant/contracts';
import { toHttpApiError } from '@core/http';
import { type SnapshotWithStream, batchPerFrame, snapshotWithStream } from '@shared/util/rx';
import { OrdersApiActions, OrdersStreamActions } from './orders.actions';

export const isOrderEvent = (event: ServerEvent): event is OrderEvent => event.type.startsWith('order.');

type OrdersSync = SnapshotWithStream<OrdersSnapshot, OrderEvent>;
const isSnapshot = (message: OrdersSync): message is Extract<OrdersSync, { kind: 'snapshot' }> =>
  message.kind === 'snapshot';
const isEvents = (message: OrdersSync): message is Extract<OrdersSync, { kind: 'events' }> => message.kind === 'events';

/** Snapshot plus buffered live events, applied in one action per frame; same flow as the menu. */
export function syncOrders(
  snapshot$: Observable<OrdersSnapshot>,
  events$: Observable<OrderEvent>,
  scheduler: SchedulerLike,
  streamStart$: Observable<number | null>,
): Observable<Action> {
  const sync$ = snapshotWithStream(snapshot$, events$, streamStart$).pipe(
    connect((shared$) =>
      merge(
        shared$.pipe(
          filter(isSnapshot),
          map(({ snapshot }) => OrdersApiActions.snapshotLoaded({ snapshot })),
        ),
        shared$.pipe(
          filter(isEvents),
          map(({ events }) => events),
          batchPerFrame<OrderEvent>(scheduler),
          map((events) => OrdersStreamActions.eventsApplied({ events })),
        ),
      ),
    ),
    catchError((error: unknown) => of(OrdersApiActions.snapshotFailed({ error: toHttpApiError(error) }))),
  );
  return concat(of(OrdersApiActions.snapshotRequested()), sync$);
}
