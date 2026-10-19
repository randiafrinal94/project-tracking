import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { deletedAt, id, timestamps } from './_shared.js';
import { taskPriority, taskStatus } from './enums.js';
import { milestones } from './milestones.js';
import { projects } from './projects.js';
import { users } from './users.js';

/** Jarak default antar `sort_order` agar reorder cukup update satu baris. */
export const SORT_ORDER_GAP = 1024;

export const tasks = pgTable(
  'tasks',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    milestoneId: uuid('milestone_id').references(() => milestones.id, { onDelete: 'set null' }),
    /**
     * Diisi trigger `assign_task_number()` saat INSERT bila NULL.
     * `$defaultFn` mengirim NULL eksplisit sehingga kolom tetap opsional di sisi aplikasi.
     */
    taskNumber: integer('task_number')
      .notNull()
      .$defaultFn(() => sql`NULL`),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    status: taskStatus('status').notNull().default('backlog'),
    priority: taskPriority('priority').notNull().default('medium'),
    sortOrder: integer('sort_order').notNull().default(0),
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    reporterId: uuid('reporter_id').references(() => users.id, { onDelete: 'set null' }),
    startDate: date('start_date'),
    dueDate: date('due_date'),
    estimateHours: numeric('estimate_hours', { precision: 5, scale: 2 }),
    actualHours: numeric('actual_hours', { precision: 5, scale: 2 }).notNull().default('0'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps(),
    deletedAt: deletedAt(),
  },
  (t) => [
    unique('uq_tasks_project_number').on(t.projectId, t.taskNumber),
    index('idx_tasks_project').on(t.projectId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_tasks_status')
      .on(t.projectId, t.status, t.sortOrder)
      .where(sql`${t.deletedAt} IS NULL`),
    index('idx_tasks_milestone').on(t.milestoneId).where(sql`${t.deletedAt} IS NULL`),
    index('idx_tasks_assignee').on(t.assigneeId).where(sql`${t.deletedAt} IS NULL`),
    check('chk_tasks_estimate_hours', sql`${t.estimateHours} IS NULL OR ${t.estimateHours} >= 0`),
    check('chk_tasks_actual_hours', sql`${t.actualHours} >= 0`),
    check(
      'chk_tasks_dates',
      sql`${t.dueDate} IS NULL OR ${t.startDate} IS NULL OR ${t.dueDate} >= ${t.startDate}`,
    ),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
