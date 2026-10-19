import { projects, tasks } from '@pt/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../db.js';
import { ok } from '../../lib/response.js';
import { requireWorkspaceRole } from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';

const count = (filter: ReturnType<typeof sql>) =>
  sql<number>`count(*) FILTER (WHERE ${filter})`.mapWith(Number);

/**
 * KPI dashboard (PRD §3.5). "Minggu ini" = sejak Senin 00:00 UTC (date_trunc('week')).
 * Hanya task & project aktif (bukan soft delete) yang dihitung.
 */
export const workspaceDashboardRoutes = new Hono<AppEnv>().get(
  '/',
  requireWorkspaceRole('viewer'),
  async (c) => {
    const workspaceId = c.var.membership.workspaceId;

    const [projectStats] = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        active: count(sql`${projects.status} = 'active'`),
      })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)));

    const [taskStats] = await db
      .select({
        total: sql<number>`count(*)`.mapWith(Number),
        done: count(sql`${tasks.status} = 'done'`),
        overdue: count(sql`${tasks.status} <> 'done' AND ${tasks.dueDate} < CURRENT_DATE`),
        completedThisWeek: count(
          sql`${tasks.completedAt} >= date_trunc('week', CURRENT_TIMESTAMP)`,
        ),
        completedLastWeek: count(
          sql`${tasks.completedAt} >= date_trunc('week', CURRENT_TIMESTAMP) - interval '7 days'
              AND ${tasks.completedAt} < date_trunc('week', CURRENT_TIMESTAMP)`,
        ),
        inProgress: count(sql`${tasks.status} = 'in_progress'`),
        inReview: count(sql`${tasks.status} = 'in_review'`),
        backlog: count(sql`${tasks.status} = 'backlog'`),
      })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(
        and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt), isNull(tasks.deletedAt)),
      );

    const t = taskStats!;
    return ok(c, {
      activeProjects: projectStats!.active,
      totalProjects: projectStats!.total,
      completedTasksThisWeek: t.completedThisWeek,
      completedTasksLastWeek: t.completedLastWeek,
      overdueItems: t.overdue,
      completionRate: t.total === 0 ? 0 : Math.round((t.done / t.total) * 100),
      tasksByStatus: { backlog: t.backlog, in_progress: t.inProgress, in_review: t.inReview, done: t.done },
      totalTasks: t.total,
    });
  },
);
