import { sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db.js';
import { ok } from '../../lib/response.js';
import { validate } from '../../lib/validate.js';
import { requireWorkspaceRole } from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';

/** Kapasitas mingguan default per anggota (jam) dan bobot task tanpa estimasi. */
export const WEEKLY_CAPACITY_HOURS = 40;
export const DEFAULT_TASK_HOURS = 4;

export type LoadLabel = 'Available' | 'Balanced' | 'Healthy' | 'High Load';

/** Ambang mengikuti contoh Stitch "Squad Workload" (60% Balanced, 75–80% Healthy, 95% High Load). */
export function loadLabel(percent: number, openTasks: number): LoadLabel {
  if (openTasks === 0) return 'Available';
  if (percent > 90) return 'High Load';
  if (percent > 70) return 'Healthy';
  return 'Balanced';
}

const rows = async <T>(query: SQL) => (await db.execute(query)).rows as T[];

/** Task aktif milik project aktif di workspace (opsional satu project). */
const scopedTasks = (workspaceId: string, projectId?: string) => sql`
  SELECT t.* FROM tasks t JOIN projects p ON p.id = t.project_id
   WHERE p.workspace_id = ${workspaceId} AND p.deleted_at IS NULL AND t.deleted_at IS NULL
   ${projectId ? sql`AND t.project_id = ${projectId}` : sql``}
`;

// ---------------------------------------------------------------------------
// Workload
// ---------------------------------------------------------------------------

interface WorkloadRow {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
  role: string;
  open_tasks: number;
  backlog: number;
  in_progress: number;
  in_review: number;
  overdue: number;
  open_estimate: string;
  weighted_hours: string;
  completed_this_week: number;
  logged_hours: string;
}

export const workspaceWorkloadRoutes = new Hono<AppEnv>().get(
  '/',
  requireWorkspaceRole('viewer'),
  validate('query', z.object({ projectId: z.uuid().optional() })),
  async (c) => {
    const workspaceId = c.var.membership.workspaceId;
    const { projectId } = c.req.valid('query');
    const scoped = scopedTasks(workspaceId, projectId);

    const members = await rows<WorkloadRow>(sql`
      WITH st AS (${scoped})
      SELECT u.id AS user_id, u.full_name, u.avatar_url, u.email, wm.role,
             count(st.id) FILTER (WHERE st.status <> 'done')::int AS open_tasks,
             count(st.id) FILTER (WHERE st.status = 'backlog')::int AS backlog,
             count(st.id) FILTER (WHERE st.status = 'in_progress')::int AS in_progress,
             count(st.id) FILTER (WHERE st.status = 'in_review')::int AS in_review,
             count(st.id) FILTER (WHERE st.status <> 'done' AND st.due_date < CURRENT_DATE)::int AS overdue,
             coalesce(sum(st.estimate_hours) FILTER (WHERE st.status <> 'done'), 0) AS open_estimate,
             coalesce(sum(coalesce(st.estimate_hours, ${DEFAULT_TASK_HOURS}::numeric)) FILTER (WHERE st.status <> 'done'), 0) AS weighted_hours,
             count(st.id) FILTER (WHERE st.completed_at >= date_trunc('week', CURRENT_TIMESTAMP))::int AS completed_this_week,
             coalesce(sum(st.actual_hours), 0) AS logged_hours
        FROM workspace_members wm
        JOIN users u ON u.id = wm.user_id
        LEFT JOIN st ON st.assignee_id = u.id
       WHERE wm.workspace_id = ${workspaceId} AND wm.role <> 'viewer'
       GROUP BY u.id, wm.role
       ORDER BY weighted_hours DESC, u.full_name
    `);

    const [unassigned] = await rows<{ open: number; weighted_hours: string }>(sql`
      WITH st AS (${scoped})
      SELECT count(*) FILTER (WHERE status <> 'done')::int AS open,
             coalesce(sum(coalesce(estimate_hours, ${DEFAULT_TASK_HOURS}::numeric)) FILTER (WHERE status <> 'done'), 0) AS weighted_hours
        FROM st WHERE assignee_id IS NULL
    `);

    return ok(c, {
      capacityHours: WEEKLY_CAPACITY_HOURS,
      defaultTaskHours: DEFAULT_TASK_HOURS,
      members: members.map((m) => {
        const weighted = Number(m.weighted_hours);
        const loadPercent = Math.round((weighted / WEEKLY_CAPACITY_HOURS) * 100);
        return {
          user: { id: m.user_id, fullName: m.full_name, avatarUrl: m.avatar_url, email: m.email },
          role: m.role,
          openTasks: m.open_tasks,
          byStatus: { backlog: m.backlog, in_progress: m.in_progress, in_review: m.in_review },
          overdue: m.overdue,
          openEstimateHours: Number(m.open_estimate),
          weightedHours: weighted,
          loggedHours: Number(m.logged_hours),
          completedThisWeek: m.completed_this_week,
          loadPercent,
          label: loadLabel(loadPercent, m.open_tasks),
        };
      }),
      unassigned: { openTasks: unassigned?.open ?? 0, weightedHours: Number(unassigned?.weighted_hours ?? 0) },
    });
  },
);

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

const reportQuery = z.object({
  weeks: z.coerce.number().int().min(4).max(26).default(8),
  projectId: z.uuid().optional(),
});

export const workspaceReportRoutes = new Hono<AppEnv>().get(
  '/',
  requireWorkspaceRole('viewer'),
  validate('query', reportQuery),
  async (c) => {
    const workspaceId = c.var.membership.workspaceId;
    const { weeks, projectId } = c.req.valid('query');
    const scoped = scopedTasks(workspaceId, projectId);

    const weekly = await rows<{ week: string; created: number; completed: number; avg_cycle_days: string | null }>(sql`
      WITH st AS (${scoped}),
      w AS (
        SELECT generate_series(
          date_trunc('week', CURRENT_TIMESTAMP) - ((${weeks}::int - 1) * interval '1 week'),
          date_trunc('week', CURRENT_TIMESTAMP),
          interval '1 week'
        ) AS week
      )
      SELECT to_char(w.week, 'YYYY-MM-DD') AS week,
             (SELECT count(*) FROM st WHERE st.created_at >= w.week AND st.created_at < w.week + interval '1 week')::int AS created,
             (SELECT count(*) FROM st WHERE st.completed_at >= w.week AND st.completed_at < w.week + interval '1 week')::int AS completed,
             (SELECT round(avg(extract(epoch FROM st.completed_at - st.created_at) / 86400)::numeric, 1)
                FROM st WHERE st.completed_at >= w.week AND st.completed_at < w.week + interval '1 week') AS avg_cycle_days
        FROM w ORDER BY w.week
    `);

    const breakdown = await rows<{ kind: string; key: string; count: number }>(sql`
      WITH st AS (${scoped})
      SELECT 'status' AS kind, status::text AS key, count(*)::int AS count FROM st GROUP BY status
      UNION ALL
      SELECT 'priority', priority::text, count(*)::int FROM st WHERE status <> 'done' GROUP BY priority
    `);

    const perProject = await rows<{
      id: string; name: string; key_prefix: string; total: number; done: number;
      overdue: number; estimate: string; actual: string;
    }>(sql`
      SELECT p.id, p.name, p.key_prefix,
             count(t.id)::int AS total,
             count(t.id) FILTER (WHERE t.status = 'done')::int AS done,
             count(t.id) FILTER (WHERE t.status <> 'done' AND t.due_date < CURRENT_DATE)::int AS overdue,
             coalesce(sum(t.estimate_hours), 0) AS estimate,
             coalesce(sum(t.actual_hours), 0) AS actual
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id AND t.deleted_at IS NULL
       WHERE p.workspace_id = ${workspaceId} AND p.deleted_at IS NULL
         ${projectId ? sql`AND p.id = ${projectId}` : sql``}
       GROUP BY p.id ORDER BY p.name
    `);

    const pick = (kind: string) =>
      Object.fromEntries(breakdown.filter((b) => b.kind === kind).map((b) => [b.key, b.count]));
    const completedTotal = weekly.reduce((s, w) => s + w.completed, 0);
    const cycles = weekly.filter((w) => w.avg_cycle_days !== null);

    return ok(c, {
      weeks,
      weekly: weekly.map((w) => ({
        weekStart: w.week,
        created: w.created,
        completed: w.completed,
        avgCycleDays: w.avg_cycle_days === null ? null : Number(w.avg_cycle_days),
      })),
      summary: {
        completed: completedTotal,
        created: weekly.reduce((s, w) => s + w.created, 0),
        avgPerWeek: Math.round((completedTotal / weeks) * 10) / 10,
        avgCycleDays: cycles.length
          ? Math.round((cycles.reduce((s, w) => s + Number(w.avg_cycle_days) * w.completed, 0) /
              cycles.reduce((s, w) => s + w.completed, 0)) * 10) / 10
          : null,
      },
      byStatus: { backlog: 0, in_progress: 0, in_review: 0, done: 0, ...pick('status') },
      openByPriority: { urgent: 0, high: 0, medium: 0, low: 0, ...pick('priority') },
      projects: perProject.map((p) => ({
        id: p.id,
        name: p.name,
        keyPrefix: p.key_prefix,
        total: p.total,
        done: p.done,
        overdue: p.overdue,
        completionRate: p.total ? Math.round((p.done / p.total) * 100) : 0,
        estimateHours: Number(p.estimate),
        actualHours: Number(p.actual),
      })),
    });
  },
);
