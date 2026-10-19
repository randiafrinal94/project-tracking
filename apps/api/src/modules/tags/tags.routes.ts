import { tags, taskTags, tasks } from '@pt/db';
import { asc, eq, getTableColumns, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db.js';
import { notFound } from '../../lib/errors.js';
import { ok } from '../../lib/response.js';
import { outer } from '../../lib/sql.js';
import { validate } from '../../lib/validate.js';
import { requireScopedRole, requireWorkspaceRole } from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';

const fields = {
  name: z.string().trim().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex value like #4F46E5')
    .transform((v) => v.toUpperCase()),
};

const createSchema = z.strictObject(fields);
const updateSchema = z
  .strictObject({ name: fields.name.optional(), color: fields.color.optional() })
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');

const usageCount = sql<number>`(
  SELECT count(*) FROM ${taskTags} tt JOIN ${tasks} t ON t.id = tt.task_id
   WHERE tt.tag_id = ${outer(tags.id)} AND t.deleted_at IS NULL
)`.mapWith(Number);

async function getTag(id: string) {
  const [tag] = await db
    .select({ ...getTableColumns(tags), usageCount })
    .from(tags)
    .where(eq(tags.id, id))
    .limit(1);
  if (!tag) throw notFound('Tag');
  return tag;
}

/** Dipasang di `/api/v1/workspaces/:workspaceId/tags`. */
export const workspaceTagRoutes = new Hono<AppEnv>()
  .get('/', requireWorkspaceRole('viewer'), async (c) =>
    ok(
      c,
      await db
        .select({ ...getTableColumns(tags), usageCount })
        .from(tags)
        .where(eq(tags.workspaceId, c.var.membership.workspaceId))
        .orderBy(asc(tags.name)),
    ),
  )
  .post('/', requireWorkspaceRole('member'), validate('json', createSchema), async (c) => {
    const [tag] = await db
      .insert(tags)
      .values({ ...c.req.valid('json'), workspaceId: c.var.membership.workspaceId })
      .returning({ id: tags.id });
    return ok(c, await getTag(tag!.id), 201);
  });

/** Dipasang di `/api/v1/tags`. Menghapus tag ikut melepasnya dari semua task. */
export const tagRoutes = new Hono<AppEnv>()
  .patch('/:tagId', requireScopedRole('tag', 'admin'), validate('json', updateSchema), async (c) => {
    const id = c.var.scope.resourceId!;
    await db.update(tags).set(c.req.valid('json')).where(eq(tags.id, id));
    return ok(c, await getTag(id));
  })
  .delete('/:tagId', requireScopedRole('tag', 'admin'), async (c) => {
    const id = c.var.scope.resourceId!;
    await db.delete(tags).where(eq(tags.id, id));
    return ok(c, { id, deleted: true });
  });
