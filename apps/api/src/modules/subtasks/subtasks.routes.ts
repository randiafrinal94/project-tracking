import { SORT_ORDER_GAP, subtasks } from '@pt/db';
import { and, asc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db.js';
import { withActor } from '../../lib/actor.js';
import { AppError, notFound } from '../../lib/errors.js';
import { ok } from '../../lib/response.js';
import { validate } from '../../lib/validate.js';
import { requireScopedRole } from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';

const title = z.string().trim().min(1).max(255);

const createSchema = z.strictObject({ title });
const updateSchema = z
  .strictObject({ title: title.optional(), isCompleted: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');
const reorderSchema = z.strictObject({ subtaskIds: z.array(z.uuid()).min(1).max(500) });

const columns = {
  id: subtasks.id,
  taskId: subtasks.taskId,
  title: subtasks.title,
  isCompleted: subtasks.isCompleted,
  completedAt: subtasks.completedAt,
  sortOrder: subtasks.sortOrder,
  createdAt: subtasks.createdAt,
  updatedAt: subtasks.updatedAt,
};

const listForTask = (taskId: string) =>
  db
    .select(columns)
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(asc(subtasks.sortOrder), asc(subtasks.createdAt));

/** Checklist beserta progress untuk progress bar kartu. */
async function checklist(taskId: string) {
  const items = await listForTask(taskId);
  const completed = items.filter((s) => s.isCompleted).length;
  return {
    items,
    progress: {
      total: items.length,
      completed,
      percent: items.length === 0 ? 0 : Math.round((completed / items.length) * 100),
    },
  };
}

/** Dipasang di `/api/v1/tasks/:taskId/subtasks`. */
export const taskSubtaskRoutes = new Hono<AppEnv>()
  .get('/', requireScopedRole('task', 'viewer'), async (c) => ok(c, await checklist(c.var.scope.taskId!)))
  .post('/', requireScopedRole('task', 'member'), validate('json', createSchema), async (c) => {
    const taskId = c.var.scope.taskId!;
    const [subtask] = await withActor(c.var.user.id, (tx) =>
      tx
        .insert(subtasks)
        .values({
          taskId,
          title: c.req.valid('json').title,
          sortOrder: sql`coalesce((SELECT max(sort_order) FROM ${subtasks} WHERE task_id = ${taskId}), 0) + ${SORT_ORDER_GAP}`,
        })
        .returning(columns),
    );
    return ok(c, subtask, 201);
  })
  .put('/order', requireScopedRole('task', 'member'), validate('json', reorderSchema), async (c) => {
    const taskId = c.var.scope.taskId!;
    const ids = c.req.valid('json').subtaskIds;

    await withActor(c.var.user.id, async (tx) => {
      const existing = await tx
        .select({ id: subtasks.id })
        .from(subtasks)
        .where(eq(subtasks.taskId, taskId))
        .for('update');
      const existingIds = new Set(existing.map((s) => s.id));
      if (ids.length !== existingIds.size || new Set(ids).size !== ids.length || !ids.every((id) => existingIds.has(id))) {
        throw new AppError(422, 'INVALID_ORDER', 'subtaskIds must list every subtask of this task exactly once');
      }
      for (const [index, id] of ids.entries()) {
        await tx
          .update(subtasks)
          .set({ sortOrder: (index + 1) * SORT_ORDER_GAP })
          .where(and(eq(subtasks.id, id), eq(subtasks.taskId, taskId)));
      }
    });
    return ok(c, await checklist(taskId));
  });

/** Dipasang di `/api/v1/subtasks`. */
export const subtaskRoutes = new Hono<AppEnv>()
  .patch('/:subtaskId', requireScopedRole('subtask', 'member'), validate('json', updateSchema), async (c) => {
    const [subtask] = await withActor(c.var.user.id, (tx) =>
      tx
        .update(subtasks)
        .set(c.req.valid('json'))
        .where(eq(subtasks.id, c.var.scope.resourceId!))
        .returning(columns),
    );
    if (!subtask) throw notFound('Subtask');
    return ok(c, subtask);
  })
  .delete('/:subtaskId', requireScopedRole('subtask', 'member'), async (c) => {
    const id = c.var.scope.resourceId!;
    await withActor(c.var.user.id, (tx) => tx.delete(subtasks).where(eq(subtasks.id, id)));
    return ok(c, { id, deleted: true });
  });
