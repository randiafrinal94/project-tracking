import type { ContentfulStatusCode } from 'hono/utils/http-status';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

/** Error yang aman dikirim ke client apa adanya. */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toBody(): ApiErrorBody {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST', details?: unknown) =>
  new AppError(400, code, message, details);

export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const forbidden = (message = 'You do not have permission to perform this action') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (resource: string) =>
  new AppError(404, 'NOT_FOUND', `${resource} not found`);

export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);

export const validationError = (details: unknown) =>
  new AppError(422, 'VALIDATION_ERROR', 'Request validation failed', details);
