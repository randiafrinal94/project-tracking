import { sql } from 'drizzle-orm';
import { index, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { deletedAt, id, timestamps } from './_shared.js';
import { tasks } from './tasks.js';
import { users } from './users.js';

export const comments = pgTable(
  'comments',
  {
    id: id(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
    /** Markdown mentah dari user (untuk diedit). Tidak pernah dirender langsung. */
    body: text('body').notNull(),
    /** Hasil render Markdown → HTML yang sudah disanitasi (allowlist) oleh API. */
    bodyHtml: text('body_html').notNull().default(''),
    ...timestamps(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index('idx_comments_task').on(t.taskId, t.createdAt).where(sql`${t.deletedAt} IS NULL`),
  ],
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
