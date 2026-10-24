import { Actions } from '@ngrx/effects';
import type { Action } from '@ngrx/store';
import { type Observable, Subject, of, throwError } from 'rxjs';
import type { MenuItem } from '@restaurant/contracts';
import type { NotificationService } from '@core/errors';
import type { HttpApiError } from '@core/http';
import { SetupApiActions, SetupPageActions } from './setup.actions';
import type { SetupApi } from './setup.api';
import { notifyMutationFailure, runMutations } from './setup.effects';
import { VERSION_CONFLICT_MESSAGE, categoryKey, itemKey } from './setup.models';

const item = (version: number): MenuItem => ({
  id: 'i1',
  categoryId: 'c1',
  name: 'Soup',
  pricing: { kind: 'fixed', price: 1000 },
  available: false,
  sortOrder: 0,
  version,
});

function collect(source: Observable<Action>): Action[] {
  const out: Action[] = [];
  source.subscribe((action) => out.push(action));
  return out;
}

describe('runMutations', () => {
  it('sends the expected version and waits for the returned version', () => {
    const actions$ = new Subject<Action>();
    const calls: unknown[] = [];
    const api = {
      updateItem: (id: string, request: unknown) => {
        calls.push([id, request]);
        return of(item(4));
      },
    } as unknown as SetupApi;
    const out = collect(runMutations(new Actions(actions$), api));
    actions$.next(SetupPageActions.availabilityToggled({ id: 'i1', available: false, expectedVersion: 3 }));
    expect(calls).toEqual([['i1', { available: false, expectedVersion: 3 }]]);
    expect(out).toEqual([
      SetupApiActions.mutationSucceeded({ key: itemKey('i1'), awaiting: { entity: 'item', id: 'i1', version: 4 } }),
    ]);
  });

  it('runs mutations of the same row one after another', () => {
    const actions$ = new Subject<Action>();
    const responses: Subject<MenuItem>[] = [];
    const api = {
      updateItem: () => {
        const response = new Subject<MenuItem>();
        responses.push(response);
        return response;
      },
    } as unknown as SetupApi;
    collect(runMutations(new Actions(actions$), api));
    actions$.next(SetupPageActions.availabilityToggled({ id: 'i1', available: false, expectedVersion: 1 }));
    actions$.next(SetupPageActions.availabilityToggled({ id: 'i1', available: true, expectedVersion: 1 }));
    actions$.next(SetupPageActions.availabilityToggled({ id: 'i2', available: true, expectedVersion: 1 }));
    expect(responses).toHaveLength(2); // i1 first, i2 in parallel; the second i1 waits
    responses[0]?.next(item(2));
    responses[0]?.complete();
    expect(responses).toHaveLength(3);
  });

  it('reports failures with the row key', () => {
    const actions$ = new Subject<Action>();
    const error: HttpApiError = { code: 'CATEGORY_NOT_EMPTY', message: 'Move or delete its items first.', status: 409 };
    const api = { deleteCategory: () => throwError(() => error) } as unknown as SetupApi;
    const out = collect(runMutations(new Actions(actions$), api));
    actions$.next(SetupPageActions.categoryDeleteConfirmed({ id: 'c1' }));
    expect(out).toEqual([SetupApiActions.mutationFailed({ key: categoryKey('c1'), error })]);
  });
});

describe('notifyMutationFailure', () => {
  function run(error: HttpApiError) {
    const actions$ = new Subject<Action>();
    const shown: [string, string][] = [];
    const notifications = {
      info: (message: string) => shown.push(['info', message]),
      error: (message: string) => shown.push(['error', message]),
    } as unknown as NotificationService;
    notifyMutationFailure(new Actions(actions$), notifications).subscribe();
    actions$.next(SetupApiActions.mutationFailed({ key: itemKey('i1'), error }));
    return shown;
  }

  it('explains a version conflict', () => {
    expect(run({ code: 'VERSION_CONFLICT', message: 'Conflict', status: 409 })).toEqual([
      ['info', VERSION_CONFLICT_MESSAGE],
    ]);
  });

  it('shows the server message for other errors, such as a non-empty category', () => {
    expect(run({ code: 'CATEGORY_NOT_EMPTY', message: 'Move or delete its items first.', status: 409 })).toEqual([
      ['error', 'Move or delete its items first.'],
    ]);
  });
});
