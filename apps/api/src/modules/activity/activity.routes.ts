import { activityLogs, projects, tasks, users } from '@pt/db';
import { and, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { db } from '../../db.js';
import { decodeCursor, encodeCursor, paginationQuery, toPage } from '../../lib/pagination.js';
import { ok } from '../../lib/response.js';
import { validate } from '../../lib/validate.js';
import {
  isAssigneeScoped,
  requireProjectRole,
  requireScopedRole,
  requireWorkspaceRole,
} from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';

const querySchema = z.object(paginationQuery(30, 100));

/** Feed terbaru → terlama, paginasi keyset (created_at, id) memakai index idx_activity_*. */
async function feed(where: SQL, cursor: string | undefined, limit: number) {
  const before = cursor ? decodeCursor(cursor) : undefined;

  const rows = await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      workspaceId: activityLogs.workspaceId,
      projectId: activityLogs.projectId,
      taskId: activityLogs.taskId,
      metadata: activityLogs.metadata,
      createdAt: activityLogs.createdAt,
      actorId: users.id,
      actorName: users.fullName,
      actorAvatarUrl: users.avatarUrl,
      projectName: projects.name,
      projectKeyPrefix: projects.keyPrefix,
    })
    .from(activityLogs)
    .leftJoin(users, eq(users.id, activityLogs.actorId))
    .leftJoin(projects, eq(projects.id, activityLogs.projectId))
    .where(
      and(
        where,
        before
          ? sql`(${activityLogs.createdAt}, ${activityLogs.id}) < (${before.order}::timestamptz, ${before.id}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
    .limit(limit + 1);

  const page = toPage(rows, limit, (r) => encodeCursor(r.createdAt, r.id));
  return {
    items: page.items.map(({ actorId, actorName, actorAvatarUrl, projectName, projectKeyPrefix, ...r }) => ({
      ...r,
      actor: actorId ? { id: actorId, fullName: actorName!, avatarUrl: actorAvatarUrl } : null,
      project: r.projectId ? { id: r.projectId, name: projectName!, keyPrefix: projectKeyPrefix! } : null,
    })),
    nextCursor: page.nextCursor,
  };
}

/** Member hanya melihat aktivitas non-task dan aktivitas task yang di-assign kepadanya. */
const visibleActivity = (c: Context<AppEnv>) =>
  isAssigneeScoped(c.var.membership.role)
    ? or(
        isNull(activityLogs.taskId),
        inArray(activityLogs.taskId, db.select({ id: tasks.id }).from(tasks).where(eq(tasks.assigneeId, c.var.user.id))),
      )
    : undefined;

/** Dipasang di `/api/v1/workspaces/:workspaceId/activity`. */
export const workspaceActivityRoutes = new Hono<AppEnv>().get(
  '/',
  requireWorkspaceRole('viewer'),
  validate('query', querySchema),
  async (c) => {
    const { cursor, limit } = c.req.valid('query');
    return ok(c, await feed(and(eq(activityLogs.workspaceId, c.var.membership.workspaceId), visibleActivity(c))!, cursor, limit));
  },
);

/** Dipasang di `/api/v1/projects/:projectId/activity`. */
export const projectActivityRoutes = new Hono<AppEnv>().get(
  '/',
  requireProjectRole('viewer'),
  validate('query', querySchema),
  async (c) => {
    const { cursor, limit } = c.req.valid('query');
    return ok(c, await feed(and(eq(activityLogs.projectId, c.var.project.id), visibleActivity(c))!, cursor, limit));
  },
);

/** Dipasang di `/api/v1/tasks/:taskId/activity`. */
export const taskActivityRoutes = new Hono<AppEnv>().get(
  '/',
  requireScopedRole('task', 'viewer'),
  validate('query', querySchema),
  async (c) => {
    const { cursor, limit } = c.req.valid('query');
    return ok(c, await feed(eq(activityLogs.taskId, c.var.scope.taskId!), cursor, limit));
  },
);
