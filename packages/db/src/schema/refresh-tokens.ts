import { sql } from 'drizzle-orm';
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id } from './_shared.js';
import { users } from './users.js';

/**
 * Refresh token (opaque) yang disimpan sebagai hash SHA-256.
 * Setiap refresh merotasi token dalam satu `family_id`; pemakaian ulang token
 * yang sudah dirotasi menandakan kebocoran sehingga seluruh family dicabut.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    familyId: uuid('family_id').notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).notNull().unique('uq_refresh_tokens_hash'),
    userAgent: varchar('user_agent', { length: 255 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_refresh_tokens_user').on(t.userId).where(sql`${t.revokedAt} IS NULL`),
    index('idx_refresh_tokens_family').on(t.familyId),
  ],
);

export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
