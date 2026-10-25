import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { filter, startWith, switchMap } from 'rxjs';
import { ConnectionActions, RealtimeService } from '@core/realtime';
import { FRAME_SCHEDULER } from '@shared/util/rx';
import { MenuPageActions } from './menu.actions';
import { MenuApi } from './menu.api';
import { isMenuEvent, syncMenu } from './menu-sync';

/**
 * Runs on start, on `resync_required` and on retry. `switchMap` drops the previous sync,
 * including its buffered events, so only one snapshot flow is ever active.
 */
export const loadMenu = createEffect(
  (
    actions$ = inject(Actions),
    api = inject(MenuApi),
    realtime = inject(RealtimeService),
    scheduler = inject(FRAME_SCHEDULER),
  ) =>
    actions$.pipe(
      ofType(ConnectionActions.resyncRequired, MenuPageActions.retryClicked),
      startWith(null),
      switchMap(() =>
        syncMenu(api.snapshot(), realtime.events$.pipe(filter(isMenuEvent)), scheduler, realtime.streamStart$),
      ),
    ),
  { functional: true },
);
