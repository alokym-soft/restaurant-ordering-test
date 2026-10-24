import type { Routes } from '@angular/router';
import { provideSymbolIcons } from '@shared/ui/icons';

export default [
  {
    path: '',
    title: 'Menu',
    providers: [provideSymbolIcons()],
    loadComponent: () => import('./menu-page.component').then((m) => m.MenuPageComponent),
  },
] satisfies Routes;
