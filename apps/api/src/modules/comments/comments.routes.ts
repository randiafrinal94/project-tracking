import { commentLikes, comments, projects, tasks, users } from '@pt/db';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db.js';
import { withActor } from '../../lib/actor.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { decodeCursor, encodeCursor, paginationQuery, toPage } from '../../lib/pagination.js';
import { ok } from '../../lib/response.js';
import { extractHandles, highlightMentions, resolveMentions } from '../../lib/mentions.js';
import { notify } from '../../lib/notify.js';
import { renderMarkdown } from '../../lib/sanitize.js';
import { validate } from '../../lib/validate.js';
import { hasRole, requireScopedRole } from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';

const body = z.string().trim().min(1).max(10_000);
const bodySchema = z.strictObject({ body });
const createSchema = z.strictObject({ body, parentId: z.uuid().optional() });
const taskKey = sql<string>`${projects.keyPrefix} || '-' || ${tasks.taskNumber}`;
const listQuerySchema = z.object(paginationQuery(50, 100));

const likeCount = sql<number>`(SELECT count(*)::int FROM ${commentLikes} l WHERE l.comment_id = ${comments.id})`;
const likedBy = (viewerId: string) =>
  sql<boolean>`EXISTS (SELECT 1 FROM ${commentLikes} l WHERE l.comment_id = ${comments.id} AND l.user_id = ${viewerId})`;

const selectComments = (viewerId: string) =>
  db
    .select({
      id: comments.id,
      taskId: comments.taskId,
      parentId: comments.parentId,
      body: comments.body,
      bodyHtml: comments.bodyHtml,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      likeCount,
      likedByMe: likedBy(viewerId),
      authorId: users.id,
      authorName: users.fullName,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(comments)
    .leftJoin(users, eq(users.id, comments.authorId));

type CommentRow = Awaited<ReturnType<typeof selectComments>>[number];

const toComment = ({ authorId, authorName, authorAvatarUrl, ...row }: CommentRow) => ({
  ...row,
  author: authorId ? { id: authorId, fullName: authorName!, avatarUrl: authorAvatarUrl } : null,
  edited: row.updatedAt.getTime() - row.createdAt.getTime() > 1000,
});

async function getComment(id: string, viewerId: string) {
  const [row] = await selectComments(viewerId).where(eq(comments.id, id)).limit(1);
  if (!row) throw notFound('Comment');
  return toComment(row);
}

async function likeState(id: string, viewerId: string) {
  const [row] = await db
    .select({ id: comments.id, likeCount, likedByMe: likedBy(viewerId) })
    .from(comments)
    .where(eq(comments.id, id))
    .limit(1);
  return row!;
}

/**
 * Dipasang di `/api/v1/tasks/:taskId/comments`. Thread terurut kronologis (lama → baru);
 * balasan ikut dalam daftar yang sama dengan `parentId` terisi.
 */
export const taskCommentRoutes = new Hono<AppEnv>()
  .get('/', requireScopedRole('task', 'viewer'), validate('query', listQuerySchema), async (c) => {
    const { cursor, limit } = c.req.valid('query');
    const after = cursor ? decodeCursor(cursor) : undefined;

    const rows = await selectComments(c.var.user.id)
      .where(
        and(
          eq(comments.taskId, c.var.scope.taskId!),
          isNull(comments.deletedAt),
          after
            ? sql`(${comments.createdAt}, ${comments.id}) > (${after.order}::timestamptz, ${after.id}::uuid)`
            : undefined,
        ),
      )
      .orderBy(asc(comments.createdAt), asc(comments.id))
      .limit(limit + 1);

    const page = toPage(rows, limit, (r) => encodeCursor(r.createdAt, r.id));
    return ok(c, { items: page.items.map(toComment), nextCursor: page.nextCursor });
  })
  .post('/', requireScopedRole('task', 'member'), validate('json', createSchema), async (c) => {
    const { body, parentId } = c.req.valid('json');
    const scope = c.var.scope;
    const actorId = c.var.user.id;

    const commentId = await withActor(actorId, async (tx) => {
      // Balasan ke balasan diratakan ke komentar akar; penulis yang dibalas tetap dinotifikasi.
      let parent: { rootId: string; authorId: string | null } | undefined;
      if (parentId) {
        const [row] = await tx
          .select({ id: comments.id, parentId: comments.parentId, authorId: comments.authorId })
          .from(comments)
          .where(and(eq(comments.id, parentId), eq(comments.taskId, scope.taskId!), isNull(comments.deletedAt)))
          .limit(1);
        if (!row) throw badRequest('The comment you are replying to no longer exists', 'PARENT_NOT_FOUND');
        parent = { rootId: row.parentId ?? row.id, authorId: row.authorId };
      }

      const mentions = await resolveMentions(tx, scope.workspaceId, extractHandles(body));
      const [comment] = await tx
        .insert(comments)
        .values({
          taskId: scope.taskId!,
          authorId: actorId,
          parentId: parent?.rootId,
          body,
          bodyHtml: highlightMentions(renderMarkdown(body), mentions),
        })
        .returning({ id: comments.id });

      // Notifikasi: yang di-mention, penulis yang dibalas, lalu assignee & reporter task (sekali per orang).
      const [task] = await tx
        .select({ assigneeId: tasks.assigneeId, reporterId: tasks.reporterId, title: tasks.title, key: taskKey })
        .from(tasks)
        .innerJoin(projects, eq(projects.id, tasks.projectId))
        .where(eq(tasks.id, scope.taskId!))
        .limit(1);
      const base = { workspaceId: scope.workspaceId, projectId: scope.projectId!, taskId: scope.taskId! };
      const metadata = { key: task!.key, title: task!.title, excerpt: body.slice(0, 140), commentId: comment!.id };
      await notify(tx, actorId, [
        ...mentions.map((m) => ({ ...base, userId: m.userId, type: 'comment.mention', metadata })),
        ...(parent?.authorId ? [{ ...base, userId: parent.authorId, type: 'comment.reply', metadata }] : []),
        ...[task!.assigneeId, task!.reporterId]
          .filter((id): id is string => !!id)
          .map((userId) => ({ ...base, userId, type: 'comment.created', metadata })),
      ]);
      return comment!.id;
    });
    return ok(c, await getComment(commentId, actorId), 201);
  });

/** Dipasang di `/api/v1/comments`. Edit: hanya penulis. Hapus: penulis atau admin+. Suka: member+. */
export const commentRoutes = new Hono<AppEnv>()
  .patch('/:commentId', requireScopedRole('comment', 'member'), validate('json', bodySchema), async (c) => {
    if (c.var.scope.ownerId !== c.var.user.id) throw forbidden('Only the author can edit this comment');
    const { body } = c.req.valid('json');
    const id = c.var.scope.resourceId!;
    await withActor(c.var.user.id, async (tx) => {
      const mentions = await resolveMentions(tx, c.var.scope.workspaceId, extractHandles(body));
      await tx
        .update(comments)
        .set({ body, bodyHtml: highlightMentions(renderMarkdown(body), mentions) })
        .where(eq(comments.id, id));
    });
    return ok(c, await getComment(id, c.var.user.id));
  })
  .delete('/:commentId', requireScopedRole('comment', 'member'), async (c) => {
    const isAuthor = c.var.scope.ownerId === c.var.user.id;
    if (!isAuthor && !hasRole(c.var.membership.role, 'admin')) {
      throw forbidden('Only the author or an admin can delete this comment');
    }
    const id = c.var.scope.resourceId!;
    const deletedAt = new Date();
    await withActor(c.var.user.id, async (tx) => {
      // Menghapus komentar akar ikut menghapus balasannya.
      await tx
        .update(comments)
        .set({ deletedAt })
        .where(and(eq(comments.parentId, id), isNull(comments.deletedAt)));
      await tx.update(comments).set({ deletedAt }).where(eq(comments.id, id));
    });
    return ok(c, { id, deleted: true });
  })
  .post('/:commentId/like', requireScopedRole('comment', 'member'), async (c) => {
    const id = c.var.scope.resourceId!;
    await db.insert(commentLikes).values({ commentId: id, userId: c.var.user.id }).onConflictDoNothing();
    return ok(c, await likeState(id, c.var.user.id));
  })
  .delete('/:commentId/like', requireScopedRole('comment', 'member'), async (c) => {
    const id = c.var.scope.resourceId!;
    await db
      .delete(commentLikes)
      .where(and(eq(commentLikes.commentId, id), eq(commentLikes.userId, c.var.user.id)));
    return ok(c, await likeState(id, c.var.user.id));
  });
