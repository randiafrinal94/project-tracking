import { sql } from 'drizzle-orm';
import { check, index, pgTable, primaryKey, uuid, varchar } from 'drizzle-orm/pg-core';
import { id, timestamps } from './_shared.js';
import { memberRole } from './enums.js';
import { users } from './users.js';

export const workspaces = pgTable(
  'workspaces',
  {
    id: id(),
    name: varchar('name', { length: 150 }).notNull(),
    slug: varchar('slug', { length: 150 }).notNull().unique('uq_workspaces_slug'),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    ...timestamps(),
  },
  (t) => [
    index('idx_workspaces_owner').on(t.ownerId),
    check('chk_workspaces_slug_format', sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: memberRole('role').notNull().default('member'),
    ...timestamps(),
  },
  (t) => [
    primaryKey({ name: 'pk_workspace_members', columns: [t.workspaceId, t.userId] }),
    index('idx_workspace_members_user').on(t.userId),
  ],
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
