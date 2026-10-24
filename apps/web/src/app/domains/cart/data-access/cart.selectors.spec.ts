import type { MenuItem } from '@restaurant/contracts';
import { MenuApiActions, initialMenuState, menuFeature } from '@menu';
import { cartFeature, cartLineAdapter, initialCartState } from './cart.feature';
import { type CartLine, cartLineId } from './cart.models';
import {
  lineIssue,
  selectCartCount,
  selectCartHasIssues,
  selectCartLineViews,
  selectCartTotals,
  selectCheckoutReview,
} from './cart.selectors';

function item(id: string, overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id,
    categoryId: 'c1',
    name: id,
    pricing: { kind: 'fixed', price: 1000 },
    available: true,
    sortOrder: 0,
    version: 1,
    ...overrides,
  };
}

function line(itemId: string, overrides: Partial<CartLine> = {}): CartLine {
  const priceKind = overrides.priceKind ?? 'fixed';
  const unitPrice = overrides.unitPrice ?? 1000;
  return {
    id: cartLineId(itemId, priceKind, unitPrice),
    itemId,
    name: itemId,
    priceKind,
    unitPrice,
    itemVersion: 1,
    quantity: 1,
    ...overrides,
  };
}

function rootState(lines: CartLine[], items: MenuItem[], discount = 0) {
  return {
    menu: menuFeature.reducer(
      initialMenuState,
      MenuApiActions.snapshotLoaded({ snapshot: { seq: 1, categories: [], items } }),
    ),
    cart: { ...initialCartState, discount, lines: cartLineAdapter.setAll(lines, initialCartState.lines) },
  };
}

describe('lineIssue', () => {
  it('matches the server rules', () => {
    expect(lineIssue(line('a'), undefined)).toEqual({ kind: 'removed', itemId: 'a' });
    expect(lineIssue(line('a'), item('a', { available: false }))).toEqual({ kind: 'unavailable', itemId: 'a' });
    expect(lineIssue(line('a'), item('a', { pricing: { kind: 'fixed', price: 1200 } }))).toEqual({
      kind: 'price_changed',
      itemId: 'a',
      previous: 1000,
      current: 1200,
    });
    expect(lineIssue(line('a', { priceKind: 'open', unitPrice: 300 }), item('a', { pricing: { kind: 'open', min: 500, max: 900 } }))).toEqual({
      kind: 'open_price_out_of_range',
      itemId: 'a',
      min: 500,
      max: 900,
    });
  });

  it('accepts lines that still match, and ignores version-only changes', () => {
    expect(lineIssue(line('a'), item('a', { version: 7, name: 'Renamed' }))).toBeNull();
    expect(lineIssue(line('a', { priceKind: 'open', unitPrice: 600 }), item('a', { pricing: { kind: 'open', min: 500, max: 900 } }))).toBeNull();
  });

  it('catches a switch from fixed to open pricing with an out-of-range price', () => {
    expect(lineIssue(line('a', { unitPrice: 1000 }), item('a', { pricing: { kind: 'open', min: 0, max: 500 } }))?.kind).toBe(
      'open_price_out_of_range',
    );
  });
});

describe('cart selectors', () => {
  const lines = [line('a', { quantity: 2 }), line('b', { unitPrice: 250, quantity: 3 })];
  const items = [item('a'), item('b', { pricing: { kind: 'fixed', price: 250 } })];

  it('computes line totals, subtotal and total in minor units', () => {
    const state = rootState(lines, items, 500);
    expect(selectCartLineViews(state).map((view) => view.lineTotal)).toEqual([2000, 750]);
    expect(selectCartTotals(state)).toEqual({ subtotal: 2750, requestedDiscount: 500, discount: 500, total: 2250 });
    expect(selectCartCount(state)).toBe(5);
  });

  it('clamps the discount to the subtotal', () => {
    expect(selectCartTotals(rootState(lines, items, 999_999))).toMatchObject({ discount: 2750, total: 0 });
  });

  it('flags lines live when the menu changes', () => {
    expect(selectCartHasIssues(rootState(lines, items))).toBe(false);
    const changed = rootState(lines, [item('a', { available: false, version: 2 })]);
    expect(selectCartLineViews(changed).map((view) => view.issue?.kind)).toEqual(['unavailable', 'removed']);
    expect(selectCartLineViews(changed)[0]?.currentItemVersion).toBe(2);
    expect(selectCartHasIssues(changed)).toBe(true);
  });

  it('feature name matches the root state key', () => {
    expect(cartFeature.name).toBe('cart');
  });
});

describe('selectCheckoutReview', () => {
  it('describes what accepting does to each affected line', () => {
    const state = rootState(
      [
        line('fine'),
        line('pricey', { unitPrice: 1000 }),
        line('gone'),
        line('off'),
        line('open', { priceKind: 'open', unitPrice: 300 }),
      ],
      [
        item('fine'),
        item('pricey', { pricing: { kind: 'fixed', price: 1500 }, version: 3 }),
        item('off', { available: false }),
        item('open', { pricing: { kind: 'open', min: 500, max: 900 } }),
      ],
    );
    expect(selectCheckoutReview(state).map(({ lineId, outcome }) => ({ lineId, outcome }))).toEqual([
      { lineId: 'pricey', outcome: { kind: 'reprice', from: 1000, to: 1500, itemVersion: 3 } },
      { lineId: 'gone', outcome: { kind: 'remove', reason: 'removed' } },
      { lineId: 'off', outcome: { kind: 'remove', reason: 'unavailable' } },
      { lineId: 'open@300', outcome: { kind: 'remove', reason: 'out_of_range', min: 500, max: 900 } },
    ]);
  });
});

describe('menu items refreshed after 409', () => {
  it('upserts newer items and drops removed ones, so live issues match the server', () => {
    const state = rootState([line('a'), line('b')], [item('a'), item('b')]);
    const menu = menuFeature.reducer(
      state.menu,
      MenuApiActions.itemsRefreshed({
        items: [item('a', { pricing: { kind: 'fixed', price: 1200 }, version: 2 })],
        removedIds: ['b'],
      }),
    );
    const issues = selectCartLineViews({ ...state, menu }).map((view) => view.issue?.kind ?? null);
    expect(issues).toEqual(['price_changed', 'removed']);
  });

  it('ignores items that are not newer than the stored ones', () => {
    const state = rootState([], [item('a', { version: 5 })]);
    const menu = menuFeature.reducer(
      state.menu,
      MenuApiActions.itemsRefreshed({ items: [item('a', { name: 'old', version: 4 })], removedIds: [] }),
    );
    expect(menu).toBe(state.menu);
  });
});
