import { inject } from '@angular/core';
import { Actions, ROOT_EFFECTS_INIT, createEffect, ofType } from '@ngrx/effects';
import { map, take, tap } from 'rxjs';
import { ConnectionActions } from './connection.actions';
import { RealtimeService } from './realtime.service';

/** Opens the socket once the store and root effects are ready. */
export const startRealtime = createEffect(
  (actions$ = inject(Actions), realtime = inject(RealtimeService)) =>
    actions$.pipe(
      ofType(ROOT_EFFECTS_INIT),
      take(1),
      tap(() => realtime.start()),
    ),
  { functional: true, dispatch: false },
);

export const connectionStateChanged = createEffect(
  (realtime = inject(RealtimeService)) =>
    realtime.state$.pipe(map((state) => ConnectionActions.stateChanged({ state }))),
  { functional: true },
);

export const resyncRequired = createEffect(
  (realtime = inject(RealtimeService)) =>
    realtime.resyncRequired$.pipe(
      map(({ serverSeq }) => ConnectionActions.resyncRequired({ serverSeq })),
    ),
  { functional: true },
);

export const reconnectRequested = createEffect(
  (actions$ = inject(Actions), realtime = inject(RealtimeService)) =>
    actions$.pipe(
      ofType(ConnectionActions.reconnectRequested),
      tap(() => realtime.reconnectNow()),
    ),
  { functional: true, dispatch: false },
);
