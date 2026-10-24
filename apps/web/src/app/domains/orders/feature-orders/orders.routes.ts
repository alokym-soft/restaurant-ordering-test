import type { Routes } from '@angular/router';
import { provideOrdersStore } from '@orders/data-access/provide-orders-store';

export default [
  {
    path: '',
    title: 'Orders',
    providers: [provideOrdersStore()],
    loadComponent: () => import('./orders-page.component').then((m) => m.OrdersPageComponent),
  },
] satisfies Routes;
