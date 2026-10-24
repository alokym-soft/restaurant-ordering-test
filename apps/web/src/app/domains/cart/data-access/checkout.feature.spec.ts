import { MenuPageActions } from '@menu';
import type { Order } from '@restaurant/contracts';
import type { HttpApiError } from '@core/http';
import { CartPageActions, CheckoutActions, CheckoutApiActions } from './cart.actions';
import { type CartState, cartFeature, initialCartState } from './cart.feature';
import type { CheckoutReviewRow } from './checkout.models';

const reducer = cartFeature.reducer;
type Action = Parameters<typeof reducer>[1];
const run = (state: CartState, ...actions: Action[]): CartState => actions.reduce(reducer, state);

const added = (itemId = 'a', unitPrice = 1000) =>
  MenuPageActions.itemAdded({ itemId, name: `Item ${itemId}`, priceKind: 'fixed', unitPrice, itemVersion: 1, quantity: 1 });

const request = { lines: [], discount: 0 };
const submitted = (idempotencyKey = 'k1') => CheckoutActions.submitted({ request, idempotencyKey });
const failed = (status: number, code: HttpApiError['code'] = 'INTERNAL') =>
  CheckoutApiActions.orderFailed({ error: { code, message: 'Failed', status } });

const withCart = run(initialCartState, added('a'), added('b', 2000));
/** A cart whose first attempt is in flight under key `k1`. */
const submitting = run(withCart, submitted());

describe('checkout: idempotency key lifecycle', () => {
  it('keeps the key while the body is unchanged', () => {
    const state = run(submitting, failed(422, 'VALIDATION_FAILED'));
    expect(state.checkout.idempotencyKey).toBeNull(); // rejected requests store nothing
    const idle = run(submitting, CheckoutApiActions.menuChanged({ changes: [] }), CartPageActions.changesDismissed());
    expect(idle.checkout).toMatchObject({ status: 'idle', idempotencyKey: 'k1' });
  });

  it.each<[string, Action]>([
    ['discount change', CartPageActions.discountChanged({ discount: 100 })],
    ['quantity change', CartPageActions.quantityChanged({ lineId: 'a', quantity: 3 })],
    ['line removal', CartPageActions.lineRemoved({ lineId: 'a' })],
    ['added item', added('c')],
    ['accepted price', CartPageActions.priceAccepted({ lineId: 'a', unitPrice: 1200, itemVersion: 2 })],
  ])('regenerates the key on a %s', (_, action) => {
    const idle = run(submitting, CheckoutApiActions.menuChanged({ changes: [] }), CartPageActions.changesDismissed());
    const state = reducer(idle, action);
    expect(state.checkout.idempotencyKey).toBeNull();
    expect(state.checkout.status).toBe('idle');
  });

  it('keeps the key when an edit does not change the body', () => {
    const idle = run(submitting, CheckoutApiActions.menuChanged({ changes: [] }), CartPageActions.changesDismissed());
    expect(reducer(idle, CartPageActions.discountChanged({ discount: 0 }))).toBe(idle);
    expect(reducer(idle, CartPageActions.quantityChanged({ lineId: 'a', quantity: 1 }))).toBe(idle);
  });

  it('applies exactly the accepted outcomes after 409 and regenerates the key', () => {
    const changes = run(
      submitting,
      CheckoutApiActions.menuChanged({ changes: [{ kind: 'unavailable', itemId: 'b' }] }),
    );
    expect(changes.checkout).toMatchObject({ status: 'changes', idempotencyKey: 'k1' });
    const resolutions: CheckoutReviewRow[] = [
      { lineId: 'a', name: 'Item a', quantity: 1, outcome: { kind: 'reprice', from: 1000, to: 1100, itemVersion: 2 } },
      { lineId: 'b', name: 'Item b', quantity: 1, outcome: { kind: 'remove', reason: 'unavailable' } },
    ];
    const state = reducer(changes, CartPageActions.changesAccepted({ resolutions }));
    expect(state.lines.ids).toEqual(['a']);
    expect(state.lines.entities['a']).toMatchObject({ unitPrice: 1100, itemVersion: 2 });
    expect(state.checkout).toMatchObject({ status: 'idle', idempotencyKey: null, lastChanges: [] });
  });

  it('ignores accepted changes outside a review', () => {
    expect(reducer(withCart, CartPageActions.changesAccepted({ resolutions: [] }))).toBe(withCart);
  });

  it('clears the cart once the order is placed', () => {
    const state = reducer(submitting, CheckoutApiActions.orderPlaced({ order: {} as Order }));
    expect(state.lines.ids).toEqual([]);
    expect(state.checkout).toMatchObject({ status: 'done', idempotencyKey: null });
  });
});

describe('checkout: ambiguous failure lock', () => {
  it.each([0, 500, 503])('locks the cart and keeps the key after status %i', (status) => {
    const state = reducer(submitting, failed(status));
    expect(state.checkout).toMatchObject({ status: 'failed', idempotencyKey: 'k1' });
  });

  it('does not lock after a definite rejection', () => {
    expect(reducer(submitting, failed(422, 'IDEMPOTENCY_MISMATCH')).checkout.status).toBe('idle');
  });

  it.each<[string, Action]>([
    ['discount change', CartPageActions.discountChanged({ discount: 100 })],
    ['quantity change', CartPageActions.quantityChanged({ lineId: 'a', quantity: 3 })],
    ['line removal', CartPageActions.lineRemoved({ lineId: 'a' })],
    ['added item', added('c')],
    ['accepted price', CartPageActions.priceAccepted({ lineId: 'a', unitPrice: 1200, itemVersion: 2 })],
  ])('blocks a %s while failed or submitting', (_, action) => {
    const locked = reducer(submitting, failed(0));
    expect(reducer(locked, action)).toBe(locked);
    expect(reducer(submitting, action)).toBe(submitting);
  });

  it('unlocks only on explicit confirmation, keeping the key until the next change', () => {
    const locked = reducer(submitting, failed(0));
    const unlocked = reducer(locked, CartPageActions.editUnlocked());
    expect(unlocked.checkout).toMatchObject({ status: 'idle', idempotencyKey: 'k1', error: null });
    const edited = reducer(unlocked, CartPageActions.discountChanged({ discount: 100 }));
    expect(edited.discount).toBe(100);
    expect(edited.checkout.idempotencyKey).toBeNull();
  });

  it('ignores unlock when not failed', () => {
    expect(reducer(withCart, CartPageActions.editUnlocked())).toBe(withCart);
  });
});
