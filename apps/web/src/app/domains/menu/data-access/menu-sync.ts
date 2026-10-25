import { type Action } from '@ngrx/store';
import { type Observable, type SchedulerLike, catchError, concat, connect, filter, map, merge, of } from 'rxjs';
import type { MenuEvent, MenuSnapshot, ServerEvent } from '@restaurant/contracts';
import { toHttpApiError } from '@core/http';
import { type SnapshotWithStream, batchPerFrame, snapshotWithStream } from '@shared/util/rx';
import { MenuApiActions, MenuStreamActions } from './menu.actions';

export const isMenuEvent = (event: ServerEvent): event is MenuEvent => event.type.startsWith('menu.');

type MenuSync = SnapshotWithStream<MenuSnapshot, MenuEvent>;
const isSnapshot = (message: MenuSync): message is Extract<MenuSync, { kind: 'snapshot' }> =>
  message.kind === 'snapshot';
const isEvents = (message: MenuSync): message is Extract<MenuSync, { kind: 'events' }> => message.kind === 'events';

/**
 * Loads a snapshot while buffering live events, then applies newer events in one action per frame.
 * The snapshot action is never delayed; event batches always follow it.
 */
export function syncMenu(
  snapshot$: Observable<MenuSnapshot>,
  events$: Observable<MenuEvent>,
  scheduler: SchedulerLike,
  streamStart$: Observable<number | null>,
): Observable<Action> {
  const sync$ = snapshotWithStream(snapshot$, events$, streamStart$).pipe(
    connect((shared$) =>
      merge(
        shared$.pipe(
          filter(isSnapshot),
          map(({ snapshot }) => MenuApiActions.snapshotLoaded({ snapshot })),
        ),
        shared$.pipe(
          filter(isEvents),
          map(({ events }) => events),
          batchPerFrame<MenuEvent>(scheduler),
          map((events) => MenuStreamActions.eventsApplied({ events })),
        ),
      ),
    ),
    catchError((error: unknown) => of(MenuApiActions.snapshotFailed({ error: toHttpApiError(error) }))),
  );
  return concat(of(MenuApiActions.snapshotRequested()), sync$);
}
