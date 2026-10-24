import { TestBed } from '@angular/core/testing';
import { Actions } from '@ngrx/effects';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { Action } from '@ngrx/store';
import { type Observable, Subject, of, throwError } from 'rxjs';
import type { CreateOrderRequest, MenuChange, MenuItem, Order } from '@restaurant/contracts';
import { connectionFeature } from '@core/realtime';
import type { HttpApiError } from '@core/http';
import { MenuApiActions } from '@menu';
import { CartPageActions, CheckoutActions, CheckoutApiActions } from './cart.actions';
import { selectCartIssues, selectCheckout, selectOrderRequest } from './cart.selectors';
import { type CheckoutState, initialCheckoutState } from './checkout.models';
import { startCheckout, submitOrder } from './checkout.effects';
import type { OrdersApi } from './orders.api';

const request: CreateOrderRequest = { lines: [{ itemId: 'a', quantity: 1, unitPrice: 1000, itemVersion: 1 }], discount: 0 };

function collect(source: Observable<Action>): Action[] {
  const out: Action[] = [];
  source.subscribe((action) => out.push(action));
  return out;
}

describe('startCheckout', () => {
  let store: MockStore;
  let actions$: Subject<Action>;
  let keys: number;
  const newKey = () => `new-${++keys}`;

  function given(checkout: Partial<CheckoutState>, options: { issues?: MenuChange[]; online?: boolean } = {}): void {
    store.overrideSelector(selectCheckout, { ...initialCheckoutState, ...checkout });
    store.overrideSelector(selectOrderRequest, request);
    store.overrideSelector(selectCartIssues, options.issues ?? []);
    store.overrideSelector(connectionFeature.selectIsOnline, options.online ?? true);
    store.refreshState();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideMockStore()] });
    store = TestBed.inject(MockStore);
    actions$ = new Subject();
    keys = 0;
  });

  const effect = () => collect(startCheckout(new Actions(actions$), store, newKey));

  it('creates a key for a new body', () => {
    given({});
    const out = effect();
    actions$.next(CartPageActions.checkoutClicked());
    expect(out).toEqual([CheckoutActions.submitted({ request, idempotencyKey: 'new-1' })]);
  });

  it('reuses the key while the body is unchanged', () => {
    given({ idempotencyKey: 'k1' });
    const out = effect();
    actions$.next(CartPageActions.checkoutClicked());
    expect(out).toEqual([CheckoutActions.submitted({ request, idempotencyKey: 'k1' })]);
  });

  it('retries an unconfirmed attempt with the same key', () => {
    given({ status: 'failed', idempotencyKey: 'k1' });
    const out = effect();
    actions$.next(CartPageActions.retryClicked());
    actions$.next(CartPageActions.checkoutClicked()); // locked: a new attempt is not allowed
    expect(out).toEqual([CheckoutActions.submitted({ request, idempotencyKey: 'k1' })]);
  });

  it('ignores retry when nothing failed', () => {
    given({ idempotencyKey: 'k1' });
    const out = effect();
    actions$.next(CartPageActions.retryClicked());
    expect(out).toEqual([]);
  });

  it('asks for a review when lines have live issues', () => {
    const issues: MenuChange[] = [{ kind: 'unavailable', itemId: 'a' }];
    given({}, { issues });
    const out = effect();
    actions$.next(CartPageActions.checkoutClicked());
    expect(out).toEqual([CheckoutActions.reviewRequired({ changes: issues })]);
  });

  it('does nothing while submitting or offline', () => {
    given({ status: 'submitting', idempotencyKey: 'k1' });
    const out = effect();
    actions$.next(CartPageActions.checkoutClicked());
    given({}, { online: false });
    actions$.next(CartPageActions.checkoutClicked());
    expect(out).toEqual([]);
  });
});

describe('submitOrder', () => {
  const order = { id: 'o1', number: 1 } as Order;
  const error = (status: number, code: HttpApiError['code'], details?: unknown): HttpApiError =>
    details === undefined ? { code, message: 'Failed', status } : { code, message: 'Failed', status, details };

  function setup(respond: () => Observable<Order>) {
    const actions$ = new Subject<Action>();
    const calls: [CreateOrderRequest, string][] = [];
    const api = {
      create: (body: CreateOrderRequest, key: string) => {
        calls.push([body, key]);
        return respond();
      },
    } as unknown as OrdersApi;
    const out = collect(submitOrder(new Actions(actions$), api));
    return { actions$, calls, out };
  }

  it('sends one request on a double submit', () => {
    const pending = new Subject<Order>();
    const { actions$, calls, out } = setup(() => pending);
    actions$.next(CheckoutActions.submitted({ request, idempotencyKey: 'k1' }));
    actions$.next(CheckoutActions.submitted({ request, idempotencyKey: 'k1' }));
    expect(calls).toHaveLength(1);
    pending.next(order);
    pending.complete();
    expect(out).toEqual([CheckoutApiActions.orderPlaced({ order })]);
  });

  it('sends the same key again on retry after an ambiguous failure', () => {
    let attempt = 0;
    const { actions$, calls, out } = setup(() =>
      ++attempt === 1 ? throwError(() => error(503, 'INTERNAL')) : of(order),
    );
    actions$.next(CheckoutActions.submitted({ request, idempotencyKey: 'k1' }));
    actions$.next(CheckoutActions.submitted({ request, idempotencyKey: 'k1' }));
    expect(calls.map(([, key]) => key)).toEqual(['k1', 'k1']);
    expect(out).toEqual([
      CheckoutApiActions.orderFailed({ error: error(503, 'INTERNAL') }),
      CheckoutApiActions.orderPlaced({ order }),
    ]);
  });

  it('refreshes the menu before reporting 409 MENU_CHANGED', () => {
    const changes: MenuChange[] = [
      { kind: 'price_changed', itemId: 'a', previous: 1000, current: 1200 },
      { kind: 'removed', itemId: 'b' },
    ];
    const items: MenuItem[] = [
      {
        id: 'a',
        categoryId: 'c1',
        name: 'Soup',
        pricing: { kind: 'fixed', price: 1200 },
        available: true,
        sortOrder: 0,
        version: 2,
      },
    ];
    const { actions$, out } = setup(() => throwError(() => error(409, 'MENU_CHANGED', { changes, items })));
    actions$.next(CheckoutActions.submitted({ request, idempotencyKey: 'k1' }));
    expect(out).toEqual([
      MenuApiActions.itemsRefreshed({ items, removedIds: ['b'] }),
      CheckoutApiActions.menuChanged({ changes }),
    ]);
  });
});
