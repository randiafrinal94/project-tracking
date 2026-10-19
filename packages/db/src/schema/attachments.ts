import { sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id } from './_shared.js';
import { tasks } from './tasks.js';
import { users } from './users.js';

/** Metadata file; binary disimpan di object storage (`storage_key`). Immutable. */
export const attachments = pgTable(
  'attachments',
  {
    id: id(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 127 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    storageKey: text('storage_key').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_attachments_task').on(t.taskId, t.createdAt),
    check('chk_attachments_size', sql`${t.sizeBytes} >= 0`),
  ],
);

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
