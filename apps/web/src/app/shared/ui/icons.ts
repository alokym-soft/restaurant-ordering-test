import type { Provider } from '@angular/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';

/**
 * Makes `<mat-icon>` use ligatures from the Material Symbols font loaded in index.html.
 * Provided by the lazy routes that use icons, so the icon module stays out of the initial bundle.
 */
export function provideSymbolIcons(): Provider {
  return { provide: MAT_ICON_DEFAULT_OPTIONS, useValue: { fontSet: 'material-symbols-outlined' } };
}