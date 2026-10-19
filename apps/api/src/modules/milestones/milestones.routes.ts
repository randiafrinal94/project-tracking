import { SORT_ORDER_GAP, milestones, projects, tasks } from '@pt/db';
import { and, asc, eq, getTableColumns, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db.js';
import { withActor } from '../../lib/actor.js';
import { notFound } from '../../lib/errors.js';
import { ok } from '../../lib/response.js';
import { outer } from '../../lib/sql.js';
import { nullableDate, validate } from '../../lib/validate.js';
import { requireProjectRole, requireScopedRole, requireWorkspaceRole } from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';

const dateRangeValid = (v: { startDate?: string | null; dueDate?: string | null }) =>
  !v.startDate || !v.dueDate || v.dueDate >= v.startDate;
const dateRangeIssue = { message: 'Due date must be on or after start date', path: ['dueDate'] };

const fields = {
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000).nullable(),
  startDate: nullableDate,
  dueDate: nullableDate,
};

const createSchema = z
  .strictObject({
    name: fields.name,
    description: fields.description.optional(),
    startDate: fields.startDate.optional(),
    dueDate: fields.dueDate.optional(),
  })
  .refine(dateRangeValid, dateRangeIssue);

const updateSchema = z
  .strictObject({
    name: fields.name.optional(),
    description: fields.description.optional(),
    startDate: fields.startDate.optional(),
    dueDate: fields.dueDate.optional(),
    /** true → completed_at = now; false → dibuka kembali. */
    completed: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required')
  .refine(dateRangeValid, dateRangeIssue);

const taskTotal = sql<number>`(
  SELECT count(*) FROM ${tasks} t WHERE t.milestone_id = ${outer(milestones.id)} AND t.deleted_at IS NULL
)`.mapWith(Number);
const taskDone = sql<number>`(
  SELECT count(*) FROM ${tasks} t
   WHERE t.milestone_id = ${outer(milestones.id)} AND t.deleted_at IS NULL AND t.status = 'done'
)`.mapWith(Number);

const selectMilestones = () =>
  db
    .select({ ...getTableColumns(milestones), taskTotal, taskDone })
    .from(milestones)
    .orderBy(asc(milestones.sortOrder), asc(milestones.createdAt));

type MilestoneRow = Awaited<ReturnType<typeof selectMilestones>>[number];

const toMilestone = ({ taskTotal: total, taskDone: done, ...m }: MilestoneRow) => ({
  ...m,
  isCompleted: m.completedAt !== null,
  progress: { total, completed: done, percent: total === 0 ? 0 : Math.round((done / total) * 100) },
});

async function getMilestone(id: string) {
  const [row] = await selectMilestones().where(eq(milestones.id, id)).limit(1);
  if (!row) throw notFound('Milestone');
  return toMilestone(row);
}

/** Dipasang di `/api/v1/workspaces/:workspaceId/milestones` — roadmap lintas project aktif. */
export const workspaceMilestoneRoutes = new Hono<AppEnv>().get('/', requireWorkspaceRole('viewer'), async (c) => {
  const rows = await db
    .select({
      ...getTableColumns(milestones),
      taskTotal,
      taskDone,
      projectName: projects.name,
      projectKeyPrefix: projects.keyPrefix,
      projectStatus: projects.status,
    })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .where(and(eq(projects.workspaceId, c.var.membership.workspaceId), isNull(projects.deletedAt)))
    .orderBy(sql`${milestones.completedAt} IS NOT NULL`, sql`${milestones.dueDate} ASC NULLS LAST`, asc(milestones.createdAt));

  return ok(
    c,
    rows.map(({ projectName, projectKeyPrefix, projectStatus, ...m }) => ({
      ...toMilestone(m),
      project: { id: m.projectId, name: projectName, keyPrefix: projectKeyPrefix, status: projectStatus },
    })),
  );
});

/** Dipasang di `/api/v1/projects/:projectId/milestones`. */
export const projectMilestoneRoutes = new Hono<AppEnv>()
  .get('/', requireProjectRole('viewer'), async (c) => {
    const rows = await selectMilestones().where(eq(milestones.projectId, c.var.project.id));
    return ok(c, rows.map(toMilestone));
  })
  .post('/', requireProjectRole('admin'), validate('json', createSchema), async (c) => {
    const projectId = c.var.project.id;
    const [row] = await withActor(c.var.user.id, (tx) =>
      tx
        .insert(milestones)
        .values({
          ...c.req.valid('json'),
          projectId,
          sortOrder: sql`coalesce((SELECT max(sort_order) FROM ${milestones} WHERE project_id = ${projectId}), 0) + ${SORT_ORDER_GAP}`,
        })
        .returning({ id: milestones.id }),
    );
    return ok(c, await getMilestone(row!.id), 201);
  });

/** Dipasang di `/api/v1/milestones`. Menghapus milestone melepas task-nya (milestone_id → NULL). */
export const milestoneRoutes = new Hono<AppEnv>()
  .patch('/:milestoneId', requireScopedRole('milestone', 'admin'), validate('json', updateSchema), async (c) => {
    const { completed, ...rest } = c.req.valid('json');
    const id = c.var.scope.resourceId!;
    await withActor(c.var.user.id, (tx) =>
      tx
        .update(milestones)
        .set({
          ...rest,
          ...(completed === undefined
            ? {}
            : { completedAt: completed ? sql`coalesce(${milestones.completedAt}, CURRENT_TIMESTAMP)` : null }),
        })
        .where(eq(milestones.id, id)),
    );
    return ok(c, await getMilestone(id));
  })
  .delete('/:milestoneId', requireScopedRole('milestone', 'admin'), async (c) => {
    const id = c.var.scope.resourceId!;
    await withActor(c.var.user.id, (tx) => tx.delete(milestones).where(eq(milestones.id, id)));
    return ok(c, { id, deleted: true });
  });
