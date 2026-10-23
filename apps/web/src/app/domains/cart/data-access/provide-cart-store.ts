import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideState } from '@ngrx/store';
import { CART_STORE_CONFIG } from './cart-storage';
import { cartFeature } from './cart.feature';

/** Root cart state, persisted to `localStorage`. */
export function provideCartStore(): EnvironmentProviders {
  return makeEnvironmentProviders([provideState(cartFeature.name, cartFeature.reducer, CART_STORE_CONFIG)]);
}
