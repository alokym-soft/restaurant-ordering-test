import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import * as ordersEffects from './orders.effects';
import { ordersFeature } from './orders.feature';

/** Lazy orders state; registered by the orders route and kept after leaving it. */
export function provideOrdersStore(): EnvironmentProviders {
  return makeEnvironmentProviders([provideState(ordersFeature), provideEffects(ordersEffects)]);
}
