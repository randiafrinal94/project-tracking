import { sql } from 'drizzle-orm';
import { index, jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { createdAt, id } from './_shared.js';
import { projects } from './projects.js';
import { tasks } from './tasks.js';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

/** Audit trail append-only. `action` berformat `<entity>.<verb>`, misal `task.moved`. */
export const activityLogs = pgTable(
  'activity_logs',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'set null' }),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 30 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    index('idx_activity_project').on(t.projectId, t.createdAt.desc()),
    index('idx_activity_workspace').on(t.workspaceId, t.createdAt.desc()),
    index('idx_activity_task').on(t.taskId, t.createdAt.desc()),
  ],
);

export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
