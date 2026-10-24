import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import * as setupEffects from './setup.effects';
import { setupFeature } from './setup.feature';

/** Lazy setup state: mutation status only. */
export function provideSetupStore(): EnvironmentProviders {
  return makeEnvironmentProviders([provideState(setupFeature), provideEffects(setupEffects)]);
}
