import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import * as menuEffects from './menu.effects';
import { menuFeature } from './menu.feature';

/** Root menu state and its sync effect. */
export function provideMenuStore(): EnvironmentProviders {
  return makeEnvironmentProviders([provideState(menuFeature), provideEffects(menuEffects)]);
}
