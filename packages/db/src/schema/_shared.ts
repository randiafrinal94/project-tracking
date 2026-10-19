import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/** UUID primary key, default `uuid_generate_v4()` (extension `uuid-ossp`). */
export const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`uuid_generate_v4()`);

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Dikelola trigger `set_updated_at()` pada setiap UPDATE. */
export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Soft delete: baris dengan `deleted_at` terisi dianggap terhapus. */
export const deletedAt = () => timestamp('deleted_at', { withTimezone: true });
