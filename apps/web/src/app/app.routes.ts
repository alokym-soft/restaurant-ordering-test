import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'menu' },
  { path: 'menu', loadChildren: () => import('@menu/feature-browse/menu.routes') },
  { path: 'orders', loadChildren: () => import('@orders/feature-orders/orders.routes') },
  { path: 'setup', loadChildren: () => import('@setup/feature-setup/setup.routes') },
  {
    path: '**',
    title: 'Not found',
    loadComponent: () => import('@core/layout/not-found.component').then((m) => m.NotFoundComponent),
  },
];
