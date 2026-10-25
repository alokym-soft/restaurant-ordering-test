import { inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import type { Action } from '@ngrx/store';
import { type Observable, catchError, concatMap, groupBy, map, mergeMap, of, tap } from 'rxjs';
import { NotificationService } from '@core/errors';
import { toHttpApiError } from '@core/http';
import { SetupApiActions, SetupPageActions, type SetupMutation } from './setup.actions';
import { SetupApi } from './setup.api';
import { mutationKey } from './setup.feature';
import { type Awaiting, VERSION_CONFLICT_MESSAGE } from './setup.models';

function request(api: SetupApi, action: SetupMutation): Observable<Awaiting> {
  switch (action.type) {
    case SetupPageActions.categoryCreated.type:
      return api
        .createCategory(action.request)
        .pipe(map((category) => ({ entity: 'category' as const, id: category.id, version: category.version })));
    case SetupPageActions.categoryUpdated.type:
      return api
        .updateCategory(action.id, action.request)
        .pipe(map((category) => ({ entity: 'category' as const, id: category.id, version: category.version })));
    case SetupPageActions.categoryDeleteConfirmed.type:
      return api
        .deleteCategory(action.id)
        .pipe(map(() => ({ entity: 'category' as const, id: action.id, removed: true as const })));
    case SetupPageActions.itemCreated.type:
      return api
        .createItem(action.request)
        .pipe(map((item) => ({ entity: 'item' as const, id: item.id, version: item.version })));
    case SetupPageActions.itemUpdated.type:
      return api
        .updateItem(action.id, action.request)
        .pipe(map((item) => ({ entity: 'item' as const, id: item.id, version: item.version })));
    case SetupPageActions.availabilityToggled.type:
      return api
        .updateItem(action.id, { available: action.available, expectedVersion: action.expectedVersion })
        .pipe(map((item) => ({ entity: 'item' as const, id: item.id, version: item.version })));
    case SetupPageActions.itemDeleteConfirmed.type:
      return api
        .deleteItem(action.id)
        .pipe(map(() => ({ entity: 'item' as const, id: action.id, removed: true as const })));
  }
}

/**
 * Mutations of the same row run one after another; different rows run in parallel. Responses are
 * not written to the menu store: the row stays pending until the event arrives.
 */
export const runMutations = createEffect(
  (actions$ = inject(Actions), api = inject(SetupApi)) =>
    actions$.pipe(
      ofType(
        SetupPageActions.categoryCreated,
        SetupPageActions.categoryUpdated,
        SetupPageActions.categoryDeleteConfirmed,
        SetupPageActions.itemCreated,
        SetupPageActions.itemUpdated,
        SetupPageActions.availabilityToggled,
        SetupPageActions.itemDeleteConfirmed,
      ),
      groupBy((action: SetupMutation) => mutationKey(action)),
      mergeMap((row$) =>
        row$.pipe(
          concatMap((action): Observable<Action> => {
            const key = mutationKey(action);
            return request(api, action).pipe(
              map((awaiting) => SetupApiActions.mutationSucceeded({ key, awaiting })),
              catchError((error: unknown) => of(SetupApiActions.mutationFailed({ key, error: toHttpApiError(error) }))),
            );
          }),
        ),
      ),
    ),
  { functional: true },
);

export const notifyMutationFailure = createEffect(
  (actions$ = inject(Actions), notifications = inject(NotificationService)) =>
    actions$.pipe(
      ofType(SetupApiActions.mutationFailed),
      tap(({ error }) => {
        if (error.code === 'VERSION_CONFLICT') notifications.info(VERSION_CONFLICT_MESSAGE);
        else notifications.error(error.message);
      }),
    ),
  { functional: true, dispatch: false },
);
