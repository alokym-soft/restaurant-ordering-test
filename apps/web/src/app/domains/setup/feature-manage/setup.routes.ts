import type { Routes } from '@angular/router';
import { provideSetupStore } from '@setup/data-access/provide-setup-store';

export default [
  {
    path: '',
    title: 'Setup',
    providers: [provideSetupStore()],
    loadComponent: () => import('./setup-page.component').then((m) => m.SetupPageComponent),
  },
] satisfies Routes;
