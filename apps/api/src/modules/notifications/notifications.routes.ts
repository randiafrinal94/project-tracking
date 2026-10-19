import { notifications, users } from '@pt/db';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db.js';
import { decodeCursor, encodeCursor, paginationQuery, toPage } from '../../lib/pagination.js';
import { ok } from '../../lib/response.js';
import { validate } from '../../lib/validate.js';
import { requireWorkspaceRole } from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';

const listQuery = z.object({
  unread: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  ...paginationQuery(20, 50),
});

const readSchema = z.union([
  z.strictObject({ ids: z.array(z.uuid()).min(1).max(100) }),
  z.strictObject({ all: z.literal(true) }),
]);

const mine = (userId: string, workspaceId: string) =>
  and(eq(notifications.userId, userId), eq(notifications.workspaceId, workspaceId));

async function unreadCount(userId: string, workspaceId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(and(mine(userId, workspaceId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

/** Dipasang di `/api/v1/workspaces/:workspaceId/notifications` — selalu milik user yang login. */
export const workspaceNotificationRoutes = new Hono<AppEnv>()
  .get('/', requireWorkspaceRole('viewer'), validate('query', listQuery), async (c) => {
    const { unread, cursor, limit } = c.req.valid('query');
    const userId = c.var.user.id;
    const workspaceId = c.var.membership.workspaceId;
    const before = cursor ? decodeCursor(cursor) : undefined;

    const rows = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        projectId: notifications.projectId,
        taskId: notifications.taskId,
        metadata: notifications.metadata,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
        actorId: users.id,
        actorName: users.fullName,
        actorAvatarUrl: users.avatarUrl,
      })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(
        and(
          mine(userId, workspaceId),
          unread ? isNull(notifications.readAt) : undefined,
          before
            ? sql`(${notifications.createdAt}, ${notifications.id}) < (${before.order}::timestamptz, ${before.id}::uuid)`
            : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1);

    const page = toPage(rows, limit, (r) => encodeCursor(r.createdAt, r.id));
    return ok(c, {
      items: page.items.map(({ actorId, actorName, actorAvatarUrl, ...n }) => ({
        ...n,
        actor: actorId ? { id: actorId, fullName: actorName!, avatarUrl: actorAvatarUrl } : null,
      })),
      nextCursor: page.nextCursor,
      unreadCount: await unreadCount(userId, workspaceId),
    });
  })
  .get('/unread-count', requireWorkspaceRole('viewer'), async (c) =>
    ok(c, { unreadCount: await unreadCount(c.var.user.id, c.var.membership.workspaceId) }),
  )
  .post('/read', requireWorkspaceRole('viewer'), validate('json', readSchema), async (c) => {
    const input = c.req.valid('json');
    const userId = c.var.user.id;
    const workspaceId = c.var.membership.workspaceId;
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          mine(userId, workspaceId),
          isNull(notifications.readAt),
          'ids' in input ? inArray(notifications.id, input.ids) : undefined,
        ),
      );
    return ok(c, { unreadCount: await unreadCount(userId, workspaceId) });
  });
