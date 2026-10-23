import { MenuPageActions, type ItemAddedProps } from '@menu';
import { CartPageActions } from './cart.actions';
import { cartFeature, initialCartState, type CartState } from './cart.feature';
import { MAX_LINE_QUANTITY } from './cart.models';

const reducer = cartFeature.reducer;

const added = (overrides: Partial<ItemAddedProps> = {}) =>
  MenuPageActions.itemAdded({
    itemId: 'a',
    name: 'Soup',
    priceKind: 'fixed',
    unitPrice: 1000,
    itemVersion: 1,
    quantity: 1,
    ...overrides,
  });

const run = (...actions: Parameters<typeof reducer>[1][]): CartState => actions.reduce(reducer, initialCartState);

describe('cart reducer', () => {
  it('merges repeated fixed-price adds into one line and refreshes the seen price', () => {
    const state = run(added({ quantity: 2 }), added({ quantity: 3, unitPrice: 1200, itemVersion: 2, name: 'Hot soup' }));
    expect(state.lines.ids).toEqual(['a']);
    expect(state.lines.entities['a']).toMatchObject({ quantity: 5, unitPrice: 1200, itemVersion: 2, name: 'Hot soup' });
  });

  it('keeps one line per entered open price', () => {
    const state = run(
      added({ priceKind: 'open', unitPrice: 500 }),
      added({ priceKind: 'open', unitPrice: 700 }),
      added({ priceKind: 'open', unitPrice: 500 }),
    );
    expect(state.lines.ids).toEqual(['a@500', 'a@700']);
    expect(state.lines.entities['a@500']?.quantity).toBe(2);
  });

  it('clamps quantities to 1..99', () => {
    const state = run(added({ quantity: 90 }), added({ quantity: 20 }));
    expect(state.lines.entities['a']?.quantity).toBe(MAX_LINE_QUANTITY);
    expect(reducer(state, CartPageActions.quantityChanged({ lineId: 'a', quantity: 0 })).lines.entities['a']?.quantity).toBe(1);
  });

  it('removes lines', () => {
    const state = reducer(run(added()), CartPageActions.lineRemoved({ lineId: 'a' }));
    expect(state.lines.ids).toEqual([]);
  });

  it('stores a non-negative integer discount', () => {
    expect(reducer(initialCartState, CartPageActions.discountChanged({ discount: 250 })).discount).toBe(250);
    expect(reducer(initialCartState, CartPageActions.discountChanged({ discount: -5 })).discount).toBe(0);
  });

  it('accepts a changed price', () => {
    const state = reducer(run(added()), CartPageActions.priceAccepted({ lineId: 'a', unitPrice: 1500, itemVersion: 4 }));
    expect(state.lines.entities['a']).toMatchObject({ unitPrice: 1500, itemVersion: 4 });
  });
});
