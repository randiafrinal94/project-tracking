import { workspaceMembers } from '@pt/db';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../../db.js';
import { notFound } from '../../lib/errors.js';
import { eventHub, type RealtimeEvent } from '../../lib/realtime.js';
import { verifyAccessToken } from '../../lib/tokens.js';
import { validate } from '../../lib/validate.js';
import type { AppEnv } from '../../types.js';

const HEARTBEAT_MS = 25_000;

const querySchema = z.object({
  workspaceId: z.uuid(),
  /** EventSource tidak bisa mengirim header Authorization → access token via query. */
  token: z.string().min(1).max(4096),
});

/**
 * `GET /api/v1/events?workspaceId=&token=` — Server-Sent Events.
 * Event: `ready`, `activity` (perubahan data workspace), `notification` (milik user).
 */
export const realtimeRoutes = new Hono<AppEnv>().get('/', validate('query', querySchema), async (c) => {
  const { workspaceId, token } = c.req.valid('query');
  const user = await verifyAccessToken(token);
  const [member] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);
  if (!member) throw notFound('Workspace');

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const send = (event: RealtimeEvent) => write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

      const unsubscribe = await eventHub.subscribe(workspaceId, user.id, send);
      const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
      c.req.raw.signal.addEventListener('abort', () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // sudah tertutup
        }
      });

      write('retry: 3000\n\n');
      write(`event: ready\ndata: ${JSON.stringify({ workspaceId, userId: user.id })}\n\n`);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // no-transform: cegah kompresi/buffering proxy (Next rewrites, nginx).
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'X-Request-Id': c.var.requestId,
    },
  });
});
