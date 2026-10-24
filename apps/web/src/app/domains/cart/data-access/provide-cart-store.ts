import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideEffects } from '@ngrx/effects';
import { provideState } from '@ngrx/store';
import { CART_STORE_CONFIG } from './cart-storage';
import { cartFeature } from './cart.feature';
import * as checkoutEffects from './checkout.effects';

/** Root cart state, persisted to `localStorage`, and the checkout effects. */
export function provideCartStore(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideState(cartFeature.name, cartFeature.reducer, CART_STORE_CONFIG),
    provideEffects(checkoutEffects),
  ]);
}
