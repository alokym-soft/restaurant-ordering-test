import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { CreateOrderRequest, Minor, Order } from '@restaurant/contracts';
import type { HttpApiError } from '@core/http';

export const CartPageActions = createActionGroup({
  source: 'Cart Page',
  events: {
    'Quantity Changed': props<{ lineId: string; quantity: number }>(),
    'Line Removed': props<{ lineId: string }>(),
    'Discount Changed': props<{ discount: Minor }>(),
    /** The user accepted the current fixed price of an item whose price changed. */
    'Price Accepted': props<{ lineId: string; unitPrice: Minor; itemVersion: number }>(),
    'Checkout Clicked': emptyProps(),
    /** Resends the unconfirmed attempt with the same body and key. */
    'Retry Clicked': emptyProps(),
    /** The user confirmed they want to edit although the unconfirmed attempt may have created an order. */
    'Edit Unlocked': emptyProps(),
  },
});

export const CheckoutActions = createActionGroup({
  source: 'Checkout',
  events: {
    'Submitted': props<{ request: CreateOrderRequest; idempotencyKey: string }>(),
  },
});

export const CheckoutApiActions = createActionGroup({
  source: 'Checkout API',
  events: {
    'Order Placed': props<{ order: Order }>(),
    'Order Failed': props<{ error: HttpApiError }>(),
  },
});
