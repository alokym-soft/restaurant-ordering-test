import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { filter, startWith, switchMap } from 'rxjs';
import { ConnectionActions, RealtimeService } from '@core/realtime';
import { FRAME_SCHEDULER } from '@shared/util/rx';
import { OrdersPageActions } from './orders.actions';
import { OrdersListApi } from './orders.api';
import { isOrderEvent, syncOrders } from './orders-sync';

/**
 * Starts when the orders feature is first opened and keeps running afterwards, so the state stays
 * live after leaving the page. Restarts on `resync_required` and on retry.
 */
export const loadOrders = createEffect(
  (
    actions$ = inject(Actions),
    api = inject(OrdersListApi),
    realtime = inject(RealtimeService),
    scheduler = inject(FRAME_SCHEDULER),
  ) =>
    actions$.pipe(
      ofType(ConnectionActions.resyncRequired, OrdersPageActions.retryClicked),
      startWith(null),
      switchMap(() =>
        syncOrders(api.snapshot(), realtime.events$.pipe(filter(isOrderEvent)), scheduler, realtime.streamStart$),
      ),
    ),
  { functional: true },
);
