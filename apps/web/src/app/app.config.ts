import { type ApplicationConfig, ErrorHandler, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { GlobalErrorHandler } from '@core/errors';
import { apiBaseUrlInterceptor, apiErrorInterceptor } from '@core/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideHttpClient(withFetch(), withInterceptors([apiBaseUrlInterceptor, apiErrorInterceptor])),
    provideRouter(routes),
  ],
};
