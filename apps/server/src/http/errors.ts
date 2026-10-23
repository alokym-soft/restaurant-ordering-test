import type { ApiError, ApiErrorCode, FieldError } from '@restaurant/contracts';

/** An error that maps directly to an `ApiError` response. */
export class AppError<C extends ApiErrorCode = ApiErrorCode, D = unknown> extends Error {
  constructor(
    readonly statusCode: number,
    readonly body: ApiError<C, D>,
  ) {
    super(body.message);
    this.name = 'AppError';
  }
}

export const notFound = (message = 'Not found.'): AppError<'NOT_FOUND'> =>
  new AppError(404, { code: 'NOT_FOUND', message });

export const validationFailed = (fields: FieldError[]): AppError<'VALIDATION_FAILED', { fields: FieldError[] }> =>
  new AppError(400, {
    code: 'VALIDATION_FAILED',
    message: fields[0] ? `Invalid request: ${fields[0].field} ${fields[0].message}.` : 'Invalid request.',
    details: { fields },
  });

export const internalError = (message = 'Something went wrong on our side. Please try again.'): AppError<'INTERNAL'> =>
  new AppError(500, { code: 'INTERNAL', message });
