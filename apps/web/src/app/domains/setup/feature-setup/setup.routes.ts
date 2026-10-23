import type { Routes } from '@angular/router';

export default [
  {
    path: '',
    title: 'Setup',
    loadComponent: () => import('./setup-page.component').then((m) => m.SetupPageComponent),
  },
] satisfies Routes;
