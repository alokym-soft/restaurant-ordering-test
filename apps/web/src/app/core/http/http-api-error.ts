import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import type { ApiError, ApiErrorCode } from '@restaurant/contracts';

/**
 * The only error shape that leaves the HTTP layer. It is a plain, serializable object
 * (safe to put into actions) and a valid `ApiError`. `status` is 0 for network failures
 * and timeouts, where nothing reached the server or nothing came back.
 */
export type HttpApiError = ApiError & { status: number };

const KNOWN_CODES: readonly ApiErrorCode[] = [
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'VERSION_CONFLICT',
  'MENU_CHANGED',
  'IDEMPOTENCY_MISMATCH',
  'INTERNAL',
];

export const NETWORK_ERROR_MESSAGE = 'Cannot reach the server. Check your connection and try again.';
export const TIMEOUT_ERROR_MESSAGE = 'The server is taking too long to respond. Please try again.';
export const SERVER_ERROR_MESSAGE = 'Something went wrong on our side. Please try again.';
export const UNKNOWN_ERROR_MESSAGE = 'Something went wrong. Please try again.';

function isApiErrorBody(body: unknown): body is ApiError {
  if (typeof body !== 'object' || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate['code'] === 'string' &&
    (KNOWN_CODES as readonly string[]).includes(candidate['code']) &&
    typeof candidate['message'] === 'string' &&
    candidate['message'].length > 0
  );
}

export function isHttpApiError(value: unknown): value is HttpApiError {
  return isApiErrorBody(value) && typeof (value as { status?: unknown }).status === 'number';
}

/** Converts anything thrown by an HTTP call into an {@link HttpApiError}. */
export function toHttpApiError(error: unknown): HttpApiError {
  if (isHttpApiError(error)) return error;

  if (error instanceof TimeoutError) {
    return { code: 'INTERNAL', message: TIMEOUT_ERROR_MESSAGE, status: 0 };
  }

  if (error instanceof HttpErrorResponse) {
    if (isApiErrorBody(error.error)) {
      const { code, message, details } = error.error;
      return details === undefined
        ? { code, message, status: error.status }
        : { code, message, details, status: error.status };
    }
    if (error.status === 0) return { code: 'INTERNAL', message: NETWORK_ERROR_MESSAGE, status: 0 };
    if (error.status === 404) {
      return { code: 'NOT_FOUND', message: 'The requested data was not found.', status: 404 };
    }
    if (error.status >= 500) return { code: 'INTERNAL', message: SERVER_ERROR_MESSAGE, status: error.status };
    return { code: 'INTERNAL', message: UNKNOWN_ERROR_MESSAGE, status: error.status };
  }

  return { code: 'INTERNAL', message: UNKNOWN_ERROR_MESSAGE, status: 0 };
}
