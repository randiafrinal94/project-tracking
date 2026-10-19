import type { ErrorHandler, NotFoundHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError } from '../lib/errors.js';
import { mapPgError } from '../lib/pg-error.js';
import { fail } from '../lib/response.js';
import type { AppEnv } from '../types.js';

export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof AppError) return fail(c, err.status, err.toBody());

  const pgError = mapPgError(err);
  if (pgError) return fail(c, pgError.status, pgError.toBody());

  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode;
    return fail(c, status, { code: 'HTTP_ERROR', message: err.message || 'Request failed' });
  }

  // Error tak terduga: log detail di server, kirim pesan generik ke client.
  console.error(`[${c.var.requestId}] Unhandled error on ${c.req.method} ${c.req.path}`, err);
  return fail(c, 500, {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    details: { requestId: c.var.requestId },
  });
};

export const notFoundHandler: NotFoundHandler<AppEnv> = (c) =>
  fail(c, 404, { code: 'ROUTE_NOT_FOUND', message: `Route ${c.req.method} ${c.req.path} not found` });
