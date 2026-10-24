import type { Routes } from '@angular/router';
import { provideSymbolIcons } from '@shared/ui/icons';
import { CartPageComponent } from './cart-page.component';

export default [
  { path: '', title: 'Cart', providers: [provideSymbolIcons()], component: CartPageComponent },
] satisfies Routes;
