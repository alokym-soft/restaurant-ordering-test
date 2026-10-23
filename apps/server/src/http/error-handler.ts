import type { FastifyError, FastifyInstance } from 'fastify';
import type { ApiError } from '@restaurant/contracts';
import { AppError } from './errors.js';

/** Every non-2xx response has the `ApiError` shape; nothing else leaks to clients. */
export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(error.body);
    }
    // Fastify's own client errors: malformed JSON, wrong content type, body too large, ...
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      const body: ApiError = {
        code: 'VALIDATION_FAILED',
        message: 'The request could not be read. Please check the data and try again.',
        details: { fields: [] },
      };
      return reply.status(400).send(body);
    }
    request.log.error({ err: error }, 'unhandled error');
    const body: ApiError = { code: 'INTERNAL', message: 'Something went wrong on our side. Please try again.' };
    return reply.status(500).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiError = { code: 'NOT_FOUND', message: 'Not found.' };
    return reply.status(404).send(body);
  });
}
