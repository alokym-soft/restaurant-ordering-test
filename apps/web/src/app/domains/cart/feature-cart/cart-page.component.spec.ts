import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { connectionFeature, initialConnectionState } from '@core/realtime';
import { MenuApiActions, initialMenuState, menuFeature } from '@menu';
import {
  type CartState,
  type CheckoutState,
  CartPageActions,
  cartFeature,
  cartLineAdapter,
  initialCartState,
} from '@cart/data-access';
import { CartPageComponent } from './cart-page.component';

const menu = menuFeature.reducer(
  initialMenuState,
  MenuApiActions.snapshotLoaded({
    snapshot: {
      seq: 1,
      categories: [],
      items: [
        {
          id: 'a',
          categoryId: 'c1',
          name: 'Soup',
          pricing: { kind: 'fixed', price: 1000 },
          available: true,
          sortOrder: 0,
          version: 1,
        },
      ],
    },
  }),
);

function state(checkout: Partial<CheckoutState>, online = true) {
  const cart: CartState = {
    ...initialCartState,
    lines: cartLineAdapter.setAll(
      [{ id: 'a', itemId: 'a', name: 'Soup', priceKind: 'fixed', unitPrice: 1000, itemVersion: 1, quantity: 1 }],
      initialCartState.lines,
    ),
    checkout: { ...initialCartState.checkout, ...checkout },
  };
  return {
    [menuFeature.name]: menu,
    [cartFeature.name]: cart,
    [connectionFeature.name]: { ...initialConnectionState, status: online ? 'online' : 'offline' },
  };
}

async function render(initialState: ReturnType<typeof state>) {
  await TestBed.configureTestingModule({
    imports: [CartPageComponent],
    providers: [provideRouter([]), provideMockStore({ initialState })],
  }).compileComponents();
  const store = TestBed.inject(MockStore);
  const dispatched: string[] = [];
  store.scannedActions$.subscribe((action) => dispatched.push(action.type));
  const fixture = TestBed.createComponent(CartPageComponent);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
  return { element, button, dispatched };
}

describe('CartPageComponent checkout', () => {
  it('places the order when online', async () => {
    const { button, dispatched } = await render(state({}));
    const place = button('Place order');
    expect(place?.disabled).toBe(false);
    place?.click();
    expect(dispatched).toContain(CartPageActions.checkoutClicked.type);
  });

  it('disables checkout while offline', async () => {
    const { button } = await render(state({}, false));
    expect(button('Place order')?.disabled).toBe(true);
  });

  it('disables checkout and editing while submitting', async () => {
    const { button } = await render(state({ status: 'submitting', idempotencyKey: 'k1' }));
    expect(button('Placing order…')?.disabled).toBe(true);
    expect(button('Remove')?.disabled).toBe(true);
  });

  it('offers only retry after an ambiguous failure', async () => {
    const { element, button, dispatched } = await render(
      state({
        status: 'failed',
        idempotencyKey: 'k1',
        error: { code: 'INTERNAL', message: 'Cannot reach the server.', status: 0 },
      }),
    );
    expect(element.textContent).toContain('Your order may have been placed');
    expect(button('Place order')).toBeUndefined();
    expect(button('Remove')?.disabled).toBe(true);
    button('Retry')?.click();
    expect(dispatched).toContain(CartPageActions.retryClicked.type);
  });
});
