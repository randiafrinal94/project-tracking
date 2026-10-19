import { sql } from 'drizzle-orm';
import { check, index, pgTable, primaryKey, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id, timestamps } from './_shared.js';
import { tasks } from './tasks.js';
import { workspaces } from './workspaces.js';

/** Tag di-scope per workspace agar dapat dipakai ulang lintas project. */
export const tags = pgTable(
  'tags',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    color: varchar('color', { length: 7 }).notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('uq_tags_workspace_name').on(t.workspaceId, sql`lower(${t.name})`),
    check('chk_tags_color_hex', sql`${t.color} ~ '^#[0-9A-Fa-f]{6}$'`),
  ],
);

export const taskTags = pgTable(
  'task_tags',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ name: 'pk_task_tags', columns: [t.taskId, t.tagId] }),
    index('idx_task_tags_tag').on(t.tagId),
  ],
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type TaskTag = typeof taskTags.$inferSelect;
