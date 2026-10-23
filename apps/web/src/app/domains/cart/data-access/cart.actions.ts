import { createActionGroup, props } from '@ngrx/store';
import type { Minor } from '@restaurant/contracts';

export const CartPageActions = createActionGroup({
  source: 'Cart Page',
  events: {
    'Quantity Changed': props<{ lineId: string; quantity: number }>(),
    'Line Removed': props<{ lineId: string }>(),
    'Discount Changed': props<{ discount: Minor }>(),
    /** The user accepted the current fixed price of an item whose price changed. */
    'Price Accepted': props<{ lineId: string; unitPrice: Minor; itemVersion: number }>(),
  },
});
