import { AppError } from './errors.js';

interface PgError {
  code: string;
  constraint?: string;
  detail?: string;
}

/** Drizzle membungkus error driver di `cause`; telusuri rantainya. */
function findPgError(error: unknown): PgError | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const candidate = current as Partial<PgError> & { cause?: unknown };
    if (typeof candidate.code === 'string' && /^[0-9A-Z]{5}$/.test(candidate.code)) {
      return candidate as PgError;
    }
    current = candidate.cause;
  }
  return undefined;
}

/** Pesan ramah untuk constraint yang bisa dipicu input user. */
const CONSTRAINT_MESSAGES: Record<string, [code: string, message: string]> = {
  uq_users_email_lower: ['EMAIL_TAKEN', 'Email is already registered'],
  uq_workspaces_slug: ['SLUG_TAKEN', 'Workspace slug is already taken'],
  uq_projects_workspace_prefix: ['KEY_PREFIX_TAKEN', 'Key prefix is already used in this workspace'],
  uq_tags_workspace_name: ['TAG_NAME_TAKEN', 'Tag name already exists in this workspace'],
  chk_projects_dates: ['INVALID_DATE_RANGE', 'Target date must be on or after start date'],
  chk_milestones_dates: ['INVALID_DATE_RANGE', 'Due date must be on or after start date'],
  chk_tasks_dates: ['INVALID_DATE_RANGE', 'Due date must be on or after start date'],
};

/** Petakan error PostgreSQL ke AppError; `undefined` bila bukan error yang dikenali. */
export function mapPgError(error: unknown): AppError | undefined {
  const pg = findPgError(error);
  if (!pg) return undefined;

  const known = pg.constraint ? CONSTRAINT_MESSAGES[pg.constraint] : undefined;

  switch (pg.code) {
    case '23505': // unique_violation
      return new AppError(409, known?.[0] ?? 'CONFLICT', known?.[1] ?? 'Resource already exists');
    case '23503': // foreign_key_violation
      return new AppError(409, 'REFERENCE_ERROR', 'Referenced resource does not exist or is in use');
    case '23514': // check_violation
      return new AppError(422, known?.[0] ?? 'CONSTRAINT_VIOLATION', known?.[1] ?? 'Value violates a data constraint');
    case '22P02': // invalid_text_representation
    case '22001': // string_data_right_truncation
    case '22003': // numeric_value_out_of_range
    case '22007': // invalid_datetime_format
    case '22008': // datetime_field_overflow
      return new AppError(422, 'INVALID_VALUE', 'One or more values are invalid');
    default:
      return undefined;
  }
}
