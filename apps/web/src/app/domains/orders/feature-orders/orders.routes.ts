import type { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Orders',
    loadComponent: () => import('./orders-page.component').then((m) => m.OrdersPageComponent),
  },
] satisfies Routes;
