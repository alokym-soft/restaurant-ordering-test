import type { Routes } from '@angular/router';
import { provideSymbolIcons } from '@shared/ui/icons';
import { provideSetupStore } from '@setup/data-access/provide-setup-store';

export default [
  {
    path: '',
    title: 'Setup',
    providers: [provideSetupStore(), provideSymbolIcons()],
    loadComponent: () => import('./setup-page.component').then((m) => m.SetupPageComponent),
  },
] satisfies Routes;
