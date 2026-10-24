import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { CreateOrderRequest, MenuChange, Minor, Order } from '@restaurant/contracts';
import type { HttpApiError } from '@core/http';
import type { CheckoutReviewRow } from './checkout.models';

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
    /** The user confirmed exactly these outcomes in the changes dialog. */
    'Changes Accepted': props<{ resolutions: CheckoutReviewRow[] }>(),
    'Changes Dismissed': emptyProps(),
  },
});

export const CheckoutActions = createActionGroup({
  source: 'Checkout',
  events: {
    /** Live issues were found before sending; the user reviews them first. */
    'Review Required': props<{ changes: MenuChange[] }>(),
    'Submitted': props<{ request: CreateOrderRequest; idempotencyKey: string }>(),
  },
});

export const CheckoutApiActions = createActionGroup({
  source: 'Checkout API',
  events: {
    'Order Placed': props<{ order: Order }>(),
    /** `409 MENU_CHANGED`: nothing was created. */
    'Menu Changed': props<{ changes: MenuChange[] }>(),
    'Order Failed': props<{ error: HttpApiError }>(),
  },
});
