import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { concatLatestFrom } from '@ngrx/operators';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, filter, from, map, of, tap } from 'rxjs';
import type { MenuChangedError } from '@restaurant/contracts';
import { NotificationService } from '@core/errors';
import { type HttpApiError, toHttpApiError } from '@core/http';
import { connectionFeature } from '@core/realtime';
import { MenuApiActions } from '@menu';
import { formatMoney } from '@shared/util/money';
import { CartPageActions, CheckoutActions, CheckoutApiActions } from './cart.actions';
import { selectCartIssues, selectCheckout, selectOrderRequest } from './cart.selectors';
import { IDEMPOTENCY_KEY_FACTORY } from './checkout.models';
import { OrdersApi } from './orders.api';

type MenuChangedDetails = NonNullable<MenuChangedError['details']>;

const isMenuChanged = (error: HttpApiError): error is HttpApiError & { details: MenuChangedDetails } =>
  error.code === 'MENU_CHANGED' && Array.isArray((error.details as Partial<MenuChangedDetails> | undefined)?.changes);

/**
 * Decides what a checkout click, a retry or accepted changes lead to:
 * - a retry is allowed only for an unconfirmed attempt and resends the same body with the same key;
 * - otherwise live issues are reviewed first, and the key is reused only while the body is unchanged.
 */
export const startCheckout = createEffect(
  (actions$ = inject(Actions), store = inject(Store), newKey = inject(IDEMPOTENCY_KEY_FACTORY)) =>
    actions$.pipe(
      ofType(CartPageActions.checkoutClicked, CartPageActions.retryClicked, CartPageActions.changesAccepted),
      concatLatestFrom(() => [
        store.select(selectCheckout),
        store.select(selectOrderRequest),
        store.select(selectCartIssues),
        store.select(connectionFeature.selectIsOnline),
      ]),
      filter(([, checkout, request, , online]) => online && checkout.status !== 'submitting' && request.lines.length > 0),
      map(([action, checkout, request, issues]) => {
        if (action.type === CartPageActions.retryClicked.type) {
          return checkout.status === 'failed' && checkout.idempotencyKey
            ? CheckoutActions.submitted({ request, idempotencyKey: checkout.idempotencyKey })
            : null;
        }
        if (checkout.status === 'failed') return null;
        if (issues.length > 0) return CheckoutActions.reviewRequired({ changes: issues });
        return CheckoutActions.submitted({ request, idempotencyKey: checkout.idempotencyKey ?? newKey() });
      }),
      filter((action) => action !== null),
    ),
  { functional: true },
);

/** One request at a time: further submits are ignored until the current one settles. */
export const submitOrder = createEffect(
  (actions$ = inject(Actions), api = inject(OrdersApi)) =>
    actions$.pipe(
      ofType(CheckoutActions.submitted),
      exhaustMap(({ request, idempotencyKey }) =>
        api.create(request, idempotencyKey).pipe(
          map((order) => CheckoutApiActions.orderPlaced({ order })),
          catchError((thrown: unknown) => {
            const error = toHttpApiError(thrown);
            if (!isMenuChanged(error)) return of(CheckoutApiActions.orderFailed({ error }));
            const { changes } = error.details;
            const items = Array.isArray(error.details.items) ? error.details.items : [];
            const removedIds = changes.flatMap((change) => (change.kind === 'removed' ? [change.itemId] : []));
            // The menu is refreshed first, so the review shows current prices and availability.
            return from([
              MenuApiActions.itemsRefreshed({ items, removedIds }),
              CheckoutApiActions.menuChanged({ changes }),
            ]);
          }),
        ),
      ),
    ),
  { functional: true },
);

export const orderPlacedNavigation = createEffect(
  (actions$ = inject(Actions), router = inject(Router), notifications = inject(NotificationService)) =>
    actions$.pipe(
      ofType(CheckoutApiActions.orderPlaced),
      tap(({ order }) => {
        notifications.info(`Order #${order.number} placed, ${formatMoney(order.total)}`);
        void router.navigate(['/orders'], { queryParams: { highlight: order.id } });
      }),
    ),
  { functional: true, dispatch: false },
);
