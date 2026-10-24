import { createActionGroup, props } from '@ngrx/store';
import type {
  CategoryId,
  CreateCategoryRequest,
  CreateItemRequest,
  ItemId,
  UpdateCategoryRequest,
  UpdateItemRequest,
} from '@restaurant/contracts';
import type { HttpApiError } from '@core/http';
import type { Awaiting, MutationKey } from './setup.models';

export const SetupPageActions = createActionGroup({
  source: 'Setup Page',
  events: {
    'Category Created': props<{ request: CreateCategoryRequest }>(),
    'Category Updated': props<{ id: CategoryId; request: UpdateCategoryRequest }>(),
    'Category Delete Confirmed': props<{ id: CategoryId }>(),
    'Item Created': props<{ request: CreateItemRequest }>(),
    'Item Updated': props<{ id: ItemId; request: UpdateItemRequest }>(),
    'Availability Toggled': props<{ id: ItemId; available: boolean; expectedVersion: number }>(),
  },
});

export const SetupApiActions = createActionGroup({
  source: 'Setup API',
  events: {
    'Mutation Succeeded': props<{ key: MutationKey; awaiting: Awaiting }>(),
    'Mutation Failed': props<{ key: MutationKey; error: HttpApiError }>(),
  },
});

export type SetupMutation = ReturnType<(typeof SetupPageActions)[keyof typeof SetupPageActions]>;
