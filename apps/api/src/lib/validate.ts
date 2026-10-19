import { zValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import { z } from 'zod';
import { validationError } from './errors.js';

/** `zValidator` dengan format error standar (422 VALIDATION_ERROR). */
export const validate = <T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) =>
  zValidator(target, schema, (result) => {
    if (!result.success) {
      throw validationError(
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      );
    }
  });

export const uuidParam = z.uuid();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string | undefined): value is string =>
  value !== undefined && UUID_RE.test(value);

/** `YYYY-MM-DD`, boleh `null` untuk mengosongkan. */
export const nullableDate = z.iso.date().nullable();
