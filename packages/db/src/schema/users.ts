import { sql } from 'drizzle-orm';
import { pgTable, text, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.js';

export const users = pgTable(
  'users',
  {
    id: id(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    avatarUrl: text('avatar_url'),
    ...timestamps(),
  },
  (t) => [uniqueIndex('uq_users_email_lower').on(sql`lower(${t.email})`)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
