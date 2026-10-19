import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.js';
import { projects } from './projects.js';

export const milestones = pgTable(
  'milestones',
  {
    id: id(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    description: text('description'),
    startDate: date('start_date'),
    dueDate: date('due_date'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    index('idx_milestones_project').on(t.projectId, t.sortOrder),
    check(
      'chk_milestones_dates',
      sql`${t.dueDate} IS NULL OR ${t.startDate} IS NULL OR ${t.dueDate} >= ${t.startDate}`,
    ),
  ],
);

export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
