import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { OrderEvent, OrdersSnapshot } from '@restaurant/contracts';
import type { HttpApiError } from '@core/http';

export const OrdersApiActions = createActionGroup({
  source: 'Orders API',
  events: {
    'Snapshot Requested': emptyProps(),
    'Snapshot Loaded': props<{ snapshot: OrdersSnapshot }>(),
    'Snapshot Failed': props<{ error: HttpApiError }>(),
  },
});

export const OrdersStreamActions = createActionGroup({
  source: 'Orders Stream',
  events: {
    /** All order events received during one animation frame, in `seq` order. */
    'Events Applied': props<{ events: OrderEvent[] }>(),
  },
});

export const OrdersPageActions = createActionGroup({
  source: 'Orders Page',
  events: {
    'Retry Clicked': emptyProps(),
  },
});
