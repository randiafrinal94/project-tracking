import { sql } from 'drizzle-orm';
import { index, pgTable, primaryKey, text, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core';
import { createdAt, deletedAt, id, timestamps } from './_shared.js';
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
    /** Komentar induk bila ini balasan. Thread hanya satu tingkat (induk selalu komentar akar). */
    parentId: uuid('parent_id').references((): AnyPgColumn => comments.id, { onDelete: 'cascade' }),
    /** Markdown mentah dari user (untuk diedit). Tidak pernah dirender langsung. */
    body: text('body').notNull(),
    /** Hasil render Markdown → HTML yang sudah disanitasi (allowlist) oleh API. */
    bodyHtml: text('body_html').notNull().default(''),
    ...timestamps(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index('idx_comments_task').on(t.taskId, t.createdAt).where(sql`${t.deletedAt} IS NULL`),
    index('idx_comments_parent').on(t.parentId).where(sql`${t.parentId} IS NOT NULL`),
  ],
);

/** "Suka" pada komentar — satu baris per (komentar, user). */
export const commentLikes = pgTable(
  'comment_likes',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: 'pk_comment_likes', columns: [t.commentId, t.userId] }),
    index('idx_comment_likes_user').on(t.userId),
  ],
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type CommentLike = typeof commentLikes.$inferSelect;
