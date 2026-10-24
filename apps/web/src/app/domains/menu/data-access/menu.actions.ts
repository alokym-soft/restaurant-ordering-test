import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { ItemId, MenuEvent, MenuItem, MenuSnapshot, Minor } from '@restaurant/contracts';
import type { HttpApiError } from '@core/http';

export const MenuApiActions = createActionGroup({
  source: 'Menu API',
  events: {
    'Snapshot Requested': emptyProps(),
    'Snapshot Loaded': props<{ snapshot: MenuSnapshot }>(),
    'Snapshot Failed': props<{ error: HttpApiError }>(),
    /**
     * Current items reported by another endpoint (checkout `409 MENU_CHANGED`), so the menu does
     * not wait for the stream to catch up. Applied only where newer than what is stored.
     */
    'Items Refreshed': props<{ items: MenuItem[]; removedIds: ItemId[] }>(),
  },
});

export const MenuStreamActions = createActionGroup({
  source: 'Menu Stream',
  events: {
    /** All menu events received during one animation frame, in `seq` order. */
    'Events Applied': props<{ events: MenuEvent[] }>(),
  },
});

export interface ItemAddedProps {
  itemId: ItemId;
  /** Display name at the time of adding, kept for lines whose item is later removed. */
  name: string;
  priceKind: 'fixed' | 'open';
  /** Fixed price shown to the user, or the open price they entered. */
  unitPrice: Minor;
  itemVersion: number;
  quantity: number;
}

export const MenuPageActions = createActionGroup({
  source: 'Menu Page',
  events: {
    'Retry Clicked': emptyProps(),
    'Item Added': props<ItemAddedProps>(),
  },
});
