import {
  type ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideState, provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { GlobalErrorHandler, NotificationService } from '@core/errors';
import { apiBaseUrlInterceptor, apiErrorInterceptor } from '@core/http';
import { connectionEffects, connectionFeature } from '@core/realtime';
import { provideMenuStore } from '@menu';
import { provideCartStore } from '@cart';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(() => {
      // Fetch the snack bar chunk after startup without delaying it.
      const notifications = inject(NotificationService);
      setTimeout(() => notifications.preload());
    }),
    provideHttpClient(withFetch(), withInterceptors([apiBaseUrlInterceptor, apiErrorInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    provideStore(),
    provideState(connectionFeature),
    provideEffects(connectionEffects),
    provideMenuStore(),
    provideCartStore(),
    isDevMode() ? provideStoreDevtools({ maxAge: 50 }) : [],
  ],
};
