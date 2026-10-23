import { type ErrorHandler, Injectable, Injector, inject } from '@angular/core';
import { UNKNOWN_ERROR_MESSAGE, isHttpApiError } from '@core/http';
import { NotificationService } from './notification.service';

/**
 * Last line of defence for errors nobody handled. Logs the original error for developers
 * and shows a safe message to the user; never a stack trace.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  // Resolved lazily: the handler is created very early, before Material is ready.
  private readonly injector = inject(Injector);

  handleError(error: unknown): void {
    console.error(error);
    const message = isHttpApiError(error) ? error.message : UNKNOWN_ERROR_MESSAGE;
    try {
      this.injector.get(NotificationService).error(message);
    } catch {
      // Notifications are best effort; the error is already logged.
    }
  }
}
