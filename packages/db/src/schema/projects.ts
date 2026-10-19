import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { deletedAt, id, timestamps } from './_shared.js';
import { projectStatus } from './enums.js';
import { users } from './users.js';
import { workspaces } from './workspaces.js';

export const projects = pgTable(
  'projects',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    keyPrefix: varchar('key_prefix', { length: 10 }).notNull(),
    description: text('description'),
    status: projectStatus('status').notNull().default('planning'),
    startDate: date('start_date'),
    targetDate: date('target_date'),
    /** Counter nomor task; dinaikkan atomik oleh trigger `assign_task_number()`. */
    taskCounter: integer('task_counter').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('uq_projects_workspace_prefix')
      .on(t.workspaceId, t.keyPrefix)
      .where(sql`${t.deletedAt} IS NULL`),
    index('idx_projects_workspace').on(t.workspaceId).where(sql`${t.deletedAt} IS NULL`),
    check('chk_projects_key_prefix_format', sql`${t.keyPrefix} ~ '^[A-Z][A-Z0-9]{1,9}$'`),
    check(
      'chk_projects_dates',
      sql`${t.targetDate} IS NULL OR ${t.startDate} IS NULL OR ${t.targetDate} >= ${t.startDate}`,
    ),
    check('chk_projects_task_counter', sql`${t.taskCounter} >= 0`),
  ],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
