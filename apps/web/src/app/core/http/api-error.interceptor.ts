import { InjectionToken, inject } from '@angular/core';
import { type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError, timeout } from 'rxjs';
import { toHttpApiError } from './http-api-error';

export const HTTP_TIMEOUT_MS = new InjectionToken<number>('HTTP_TIMEOUT_MS', { factory: () => 15_000 });

/**
 * Applies a request timeout and rethrows every failure as an `HttpApiError`,
 * so callers never deal with `HttpErrorResponse`, raw bodies or status codes alone.
 */
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const timeoutMs = inject(HTTP_TIMEOUT_MS);
  return next(req).pipe(
    timeout(timeoutMs),
    catchError((error: unknown) => throwError(() => toHttpApiError(error))),
  );
};
