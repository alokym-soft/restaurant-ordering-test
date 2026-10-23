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

export const versionConflict = <T>(current: T): AppError<'VERSION_CONFLICT', { current: T }> =>
  new AppError(409, {
    code: 'VERSION_CONFLICT',
    message: 'This entry was changed by someone else. The form now shows the latest values.',
    details: { current },
  });

export const categoryNotEmpty = (): AppError<'CATEGORY_NOT_EMPTY'> =>
  new AppError(409, {
    code: 'CATEGORY_NOT_EMPTY',
    message: 'This category still has items. Move or delete them first.',
  });

export const idempotencyMismatch = (): AppError<'IDEMPOTENCY_MISMATCH'> =>
  new AppError(422, {
    code: 'IDEMPOTENCY_MISMATCH',
    message: 'This checkout was already submitted with different contents. Please review your cart and try again.',
  });

export const internalError = (message = 'Something went wrong on our side. Please try again.'): AppError<'INTERNAL'> =>
  new AppError(500, { code: 'INTERNAL', message });
