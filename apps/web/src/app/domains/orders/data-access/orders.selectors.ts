import { type MemoizedSelector, createSelector, createSelectorFactory, resultMemoize } from '@ngrx/store';
import type { EntityState } from '@ngrx/entity';
import type { Order, OrderId } from '@restaurant/contracts';
import { ordersFeature } from './orders.feature';

export const selectOrderEntities = createSelector(ordersFeature.selectOrders, (state) => state.entities);

const newestFirst = (a: Order, b: Order): number => b.number - a.number;

const sameIds = (a: readonly OrderId[], b: readonly OrderId[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);

/** Keeps its reference while the ids are equal, so status changes do not rebuild the list. */
const createIdsSelector = createSelectorFactory((projector) =>
  resultMemoize(projector, (a: OrderId[], b: OrderId[]) => sameIds(a, b)),
);

/** Ids only: a status change does not rebuild the list, only the affected card re-renders. */
export const selectOrderIdsNewestFirst: MemoizedSelector<object, OrderId[]> = createIdsSelector(
  ordersFeature.selectOrders,
  (state: EntityState<Order>): OrderId[] =>
    Object.values(state.entities)
      .filter((order): order is Order => order !== undefined)
      .sort(newestFirst)
      .map((order) => order.id),
);

export const selectOrderById = (id: OrderId) => createSelector(selectOrderEntities, (entities) => entities[id]);

export const selectOrdersIsEmptyLoading = createSelector(
  ordersFeature.selectStatus,
  selectOrderIdsNewestFirst,
  (status, ids) => (status === 'idle' || status === 'loading') && ids.length === 0,
);
