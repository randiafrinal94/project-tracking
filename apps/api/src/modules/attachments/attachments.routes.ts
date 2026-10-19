import { randomUUID } from 'node:crypto';
import { attachments, users } from '@pt/db';
import { desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { env } from '../../config/env.js';
import { db } from '../../db.js';
import { withActor } from '../../lib/actor.js';
import { AppError, forbidden, notFound } from '../../lib/errors.js';
import { ok } from '../../lib/response.js';
import { deleteObject, openObject, saveObject } from '../../lib/storage.js';
import { hasRole, requireScopedRole } from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';

const MAX_FILES_PER_REQUEST = 10;

/** Tipe yang aman ditampilkan inline (preview). SVG sengaja tidak termasuk (bisa memuat script). */
const INLINE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

/** Buang komponen path & karakter kontrol; nama asli hanya disimpan di DB. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim().slice(0, 255);
  return cleaned || 'file';
}

const normalizeMime = (type: string) =>
  /^[\w.+-]+\/[\w.+-]+$/.test(type) && type.length <= 127 ? type.toLowerCase() : 'application/octet-stream';

const selectAttachments = () =>
  db
    .select({
      id: attachments.id,
      taskId: attachments.taskId,
      fileName: attachments.fileName,
      mimeType: attachments.mimeType,
      sizeBytes: attachments.sizeBytes,
      createdAt: attachments.createdAt,
      uploaderId: users.id,
      uploaderName: users.fullName,
      uploaderAvatarUrl: users.avatarUrl,
    })
    .from(attachments)
    .leftJoin(users, eq(users.id, attachments.uploadedBy));

type Row = Awaited<ReturnType<typeof selectAttachments>>[number];

const toAttachment = ({ uploaderId, uploaderName, uploaderAvatarUrl, ...row }: Row) => ({
  ...row,
  previewable: INLINE_IMAGE_TYPES.has(row.mimeType),
  uploadedBy: uploaderId ? { id: uploaderId, fullName: uploaderName!, avatarUrl: uploaderAvatarUrl } : null,
});

/** Dipasang di `/api/v1/tasks/:taskId/attachments`. */
export const taskAttachmentRoutes = new Hono<AppEnv>()
  .get('/', requireScopedRole('task', 'viewer'), async (c) => {
    const rows = await selectAttachments()
      .where(eq(attachments.taskId, c.var.scope.taskId!))
      .orderBy(desc(attachments.createdAt));
    return ok(c, rows.map(toAttachment));
  })
  .post('/', requireScopedRole('task', 'member'), async (c) => {
    const body = await c.req.parseBody({ all: true }).catch(() => {
      throw new AppError(400, 'INVALID_MULTIPART', 'Expected multipart/form-data with a "file" field');
    });
    const raw = body.file;
    const files = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((f): f is File => f instanceof File);

    if (files.length === 0) throw new AppError(422, 'NO_FILE', 'Attach at least one file in the "file" field');
    if (files.length > MAX_FILES_PER_REQUEST) {
      throw new AppError(422, 'TOO_MANY_FILES', `Upload at most ${MAX_FILES_PER_REQUEST} files at once`);
    }
    const maxBytes = env.MAX_UPLOAD_MB * 1024 * 1024;
    for (const file of files) {
      if (file.size === 0) throw new AppError(422, 'EMPTY_FILE', `"${sanitizeFileName(file.name)}" is empty`);
      if (file.size > maxBytes) {
        throw new AppError(413, 'PAYLOAD_TOO_LARGE', `"${sanitizeFileName(file.name)}" exceeds ${env.MAX_UPLOAD_MB} MB`);
      }
    }

    const taskId = c.var.scope.taskId!;
    const written: string[] = [];
    try {
      const ids = await withActor(c.var.user.id, async (tx) => {
        const inserted: string[] = [];
        for (const file of files) {
          const storageKey = `${taskId}/${randomUUID()}`;
          await saveObject(storageKey, new Uint8Array(await file.arrayBuffer()));
          written.push(storageKey);
          const [row] = await tx
            .insert(attachments)
            .values({
              taskId,
              uploadedBy: c.var.user.id,
              fileName: sanitizeFileName(file.name),
              mimeType: normalizeMime(file.type),
              sizeBytes: file.size,
              storageKey,
            })
            .returning({ id: attachments.id });
          inserted.push(row!.id);
        }
        return inserted;
      });
      const rows = await selectAttachments().where(eq(attachments.taskId, taskId)).orderBy(desc(attachments.createdAt));
      return ok(c, rows.filter((r) => ids.includes(r.id)).map(toAttachment), 201);
    } catch (error) {
      // Transaksi gagal → hapus file yang sudah sempat ditulis agar tidak ada file yatim.
      await Promise.all(written.map((key) => deleteObject(key).catch(() => undefined)));
      throw error;
    }
  });

/** Dipasang di `/api/v1/attachments`. */
export const attachmentRoutes = new Hono<AppEnv>()
  .get('/:attachmentId/download', requireScopedRole('attachment', 'viewer'), async (c) => {
    const [row] = await db
      .select()
      .from(attachments)
      .where(eq(attachments.id, c.var.scope.resourceId!))
      .limit(1);
    if (!row) throw notFound('Attachment');

    const { stream, size } = await openObject(row.storageKey);
    const inline = c.req.query('inline') === '1' && INLINE_IMAGE_TYPES.has(row.mimeType);
    const encoded = encodeURIComponent(row.fileName);
    const ascii = row.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');

    return new Response(stream, {
      headers: {
        // Non-preview selalu diunduh (attachment) + nosniff + CSP sandbox, jadi tipe asli aman dikirim.
        'Content-Type': row.mimeType,
        'Content-Length': String(size),
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encoded}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, max-age=300',
        'X-Request-Id': c.var.requestId,
      },
    });
  })
  .delete('/:attachmentId', requireScopedRole('attachment', 'member'), async (c) => {
    const isUploader = c.var.scope.ownerId === c.var.user.id;
    if (!isUploader && !hasRole(c.var.membership.role, 'admin')) {
      throw forbidden('Only the uploader or an admin can delete this attachment');
    }
    const id = c.var.scope.resourceId!;
    const [row] = await withActor(c.var.user.id, (tx) =>
      tx.delete(attachments).where(eq(attachments.id, id)).returning({ storageKey: attachments.storageKey }),
    );
    if (row) await deleteObject(row.storageKey).catch(() => undefined);
    return ok(c, { id, deleted: true });
  });
