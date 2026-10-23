import { cartLineAdapter, cartFeature, initialCartState, type CartState } from './cart.feature';
import { CART_STORAGE_KEY, type CartStorage, cartStorageMetaReducer, parseStoredCart, serializeCart } from './cart-storage';
import { CartPageActions } from './cart.actions';
import type { CartLine } from './cart.models';

/** `id` is deliberately wrong: it must be derived again on load. */
const validLine: CartLine = {
  id: 'x',
  itemId: 'a',
  name: 'Soup',
  priceKind: 'fixed',
  unitPrice: 1000,
  itemVersion: 1,
  quantity: 2,
};

function memoryStorage(initial: string | null = null): CartStorage & { value: string | null } {
  return {
    value: initial,
    getItem() {
      return this.value;
    },
    setItem(_key: string, value: string) {
      this.value = value;
    },
  };
}

describe('parseStoredCart', () => {
  it('returns null for missing, broken or unknown data', () => {
    expect(parseStoredCart(null)).toBeNull();
    expect(parseStoredCart('{not json')).toBeNull();
    expect(parseStoredCart(JSON.stringify({ v: 99, lines: [] }))).toBeNull();
    expect(parseStoredCart(JSON.stringify({ v: 1, lines: 'nope' }))).toBeNull();
  });

  it('drops invalid lines and derives ids again', () => {
    const parsed = parseStoredCart(
      JSON.stringify({
        v: 1,
        discount: 300,
        lines: [
          validLine,
          { ...validLine, itemId: 'b', priceKind: 'open', unitPrice: 750 },
          { ...validLine, itemId: 'c', unitPrice: 10.5 },
          { ...validLine, itemId: 'd', quantity: 0 },
          { ...validLine, itemId: 'e', priceKind: 'free' },
          null,
        ],
      }),
    );
    expect(parsed?.lines.ids).toEqual(['a', 'b@750']);
    expect(parsed?.discount).toBe(300);
  });

  it('resets an invalid discount to zero', () => {
    expect(parseStoredCart(JSON.stringify({ v: 1, lines: [], discount: -1 }))?.discount).toBe(0);
    expect(parseStoredCart(JSON.stringify({ v: 1, lines: [], discount: 'lots' }))?.discount).toBe(0);
  });

  it('round-trips a serialized cart', () => {
    const state: CartState = {
      ...initialCartState,
      discount: 100,
      lines: cartLineAdapter.setAll([{ ...validLine, id: 'a' }], initialCartState.lines),
    };
    expect(parseStoredCart(serializeCart(state))).toEqual({ lines: state.lines, discount: 100 });
  });
});

describe('cartStorageMetaReducer', () => {
  it('restores the saved cart on first use and saves changes', () => {
    const storage = memoryStorage(JSON.stringify({ v: 1, lines: [validLine], discount: 0 }));
    const reducer = cartStorageMetaReducer(storage)(cartFeature.reducer);

    const restored = reducer(undefined, { type: '@ngrx/store/update-reducers' });
    expect(restored.lines.ids).toEqual(['a']);

    const next = reducer(restored, CartPageActions.discountChanged({ discount: 500 }));
    expect(JSON.parse(storage.value ?? '{}')).toMatchObject({ v: 1, discount: 500 });

    storage.value = 'untouched';
    reducer(next, { type: 'unrelated' });
    expect(storage.value).toBe('untouched');
  });

  it('keeps working when storage throws', () => {
    const storage: CartStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const reducer = cartStorageMetaReducer(storage)(cartFeature.reducer);
    const state = reducer(undefined, { type: 'init' });
    expect(state).toEqual(initialCartState);
    expect(reducer(state, CartPageActions.discountChanged({ discount: 1 })).discount).toBe(1);
  });

  it('uses a stable storage key', () => {
    expect(CART_STORAGE_KEY).toBe('restaurant.cart');
  });
});
