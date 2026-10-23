import {
  type ApplicationConfig,
  ErrorHandler,
  isDevMode,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { GlobalErrorHandler } from '@core/errors';
import { apiBaseUrlInterceptor, apiErrorInterceptor } from '@core/http';
import { connectionEffects, connectionFeature } from '@core/realtime';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideHttpClient(withFetch(), withInterceptors([apiBaseUrlInterceptor, apiErrorInterceptor])),
    provideRouter(routes),
    provideStore(),
    provideState(connectionFeature),
    provideEffects(connectionEffects),
    isDevMode() ? provideStoreDevtools({ maxAge: 50 }) : [],
  ],
};
