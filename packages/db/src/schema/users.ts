import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.js';

export const users = pgTable(
  'users',
  {
    id: id(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    avatarUrl: text('avatar_url'),
    /** Akun level owner: hanya akun ini yang boleh membuat workspace baru. */
    canCreateWorkspace: boolean('can_create_workspace').notNull().default(false),
    ...timestamps(),
  },
  (t) => [uniqueIndex('uq_users_email_lower').on(sql`lower(${t.email})`)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
