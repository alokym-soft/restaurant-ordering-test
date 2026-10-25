import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import type { Order } from '@restaurant/contracts';
import {
  OrdersPageActions,
  ordersFeature,
  selectOrderEntities,
  selectOrderIdsNewestFirst,
  selectOrdersIsEmptyLoading,
} from '@orders/data-access';
import { OrdersPageComponent } from './orders-page.component';

const at = '2026-10-24T12:00:00.000Z';
const order = (id: string, number: number, changes: Partial<Order> = {}): Order => ({
  id,
  number,
  lines: [{ itemId: 'i1', name: 'Soup', unitPrice: 1250, quantity: 2, lineTotal: 2500 }],
  subtotal: 2500,
  discount: 0,
  total: 2500,
  status: 'accepted',
  createdAt: at,
  updatedAt: at,
  version: 1,
  ...changes,
});

describe('OrdersPageComponent', () => {
  let store: MockStore;

  function setOrders(orders: Order[]): void {
    store.overrideSelector(
      selectOrderIdsNewestFirst,
      orders.map((o) => o.id),
    );
    store.overrideSelector(selectOrderEntities, Object.fromEntries(orders.map((o) => [o.id, o])));
    store.refreshState();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OrdersPageComponent],
      providers: [provideRouter([]), provideMockStore()],
    });
    store = TestBed.inject(MockStore);
    store.overrideSelector(ordersFeature.selectStatus, 'loaded');
    store.overrideSelector(ordersFeature.selectError, null);
    store.overrideSelector(selectOrdersIsEmptyLoading, false);
  });

  function render() {
    const fixture = TestBed.createComponent(OrdersPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const card = (id: string) => element.querySelector(`[data-order-id="${id}"]`);
    return { fixture, element, card };
  }

  it('renders one card per order, newest first, with number, lines, total and status', () => {
    setOrders([order('o2', 2), order('o1', 1)]);
    const { element, card } = render();

    const numbers = [...element.querySelectorAll('app-order-card .number')].map((n) => n.textContent?.trim());
    expect(numbers).toEqual(['#2', '#1']);
    expect(card('o1')?.textContent).toContain('Soup');
    expect(card('o1')?.textContent).toContain('$25.00');
    expect(card('o1')?.querySelector('[role="status"]')?.textContent?.trim()).toBe('Accepted');
  });

  it('updates only the status of the card whose order changed', () => {
    setOrders([order('o2', 2), order('o1', 1)]);
    const { fixture, card } = render();
    const untouched = card('o2');

    setOrders([order('o2', 2), order('o1', 1, { status: 'preparing', version: 2 })]);
    fixture.detectChanges();

    expect(card('o1')?.querySelector('[role="status"]')?.textContent?.trim()).toBe('Preparing');
    expect(card('o2')?.querySelector('[role="status"]')?.textContent?.trim()).toBe('Accepted');
    expect(card('o2')).toBe(untouched); // same DOM node: the list was not re-created
  });

  it('shows the empty state with a link to the menu', () => {
    setOrders([]);
    const { element } = render();
    expect(element.textContent).toContain('No orders yet.');
    expect(element.querySelector('a[href="/menu"]')).not.toBeNull();
  });

  it('shows a retry when loading failed and there is nothing to show', () => {
    setOrders([]);
    store.overrideSelector(ordersFeature.selectStatus, 'error');
    store.overrideSelector(ordersFeature.selectError, { code: 'INTERNAL', message: 'Server down', status: 500 });
    store.refreshState();
    const dispatch = vi.spyOn(store, 'dispatch');
    const { element } = render();

    expect(element.textContent).toContain('Orders could not be loaded');
    const retry = [...element.querySelectorAll('button')].find((b) => b.textContent?.includes('Try again'));
    expect(retry).toBeDefined();
    retry?.click();
    expect(dispatch).toHaveBeenCalledWith(OrdersPageActions.retryClicked());
  });
});
