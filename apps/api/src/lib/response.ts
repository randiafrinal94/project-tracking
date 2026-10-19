import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ApiErrorBody } from './errors.js';

/** Envelope standar SKILL.md §2.2. */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorBody | null;
  timestamp: string;
}

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  const body: ApiResponse<T> = {
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
  };
  return c.json(body, status);
}

export function fail(c: Context, status: ContentfulStatusCode, error: ApiErrorBody) {
  const body: ApiResponse<null> = {
    success: false,
    data: null,
    error,
    timestamp: new Date().toISOString(),
  };
  return c.json(body, status);
}
