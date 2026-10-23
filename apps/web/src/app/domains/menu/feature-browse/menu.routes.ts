import type { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Menu',
    loadComponent: () => import('./menu-page.component').then((m) => m.MenuPageComponent),
  },
] satisfies Routes;
