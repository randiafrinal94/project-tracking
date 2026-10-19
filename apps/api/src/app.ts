import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { env } from './config/env.js';
import { db } from './db.js';
import { AppError } from './lib/errors.js';
import { ok } from './lib/response.js';
import { requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import {
  projectActivityRoutes,
  taskActivityRoutes,
  workspaceActivityRoutes,
} from './modules/activity/activity.routes.js';
import { attachmentRoutes, taskAttachmentRoutes } from './modules/attachments/attachments.routes.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { commentRoutes, taskCommentRoutes } from './modules/comments/comments.routes.js';
import { workspaceDashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { workspaceReportRoutes, workspaceWorkloadRoutes } from './modules/insights/insights.routes.js';
import { milestoneRoutes, projectMilestoneRoutes, workspaceMilestoneRoutes } from './modules/milestones/milestones.routes.js';
import { workspaceNotificationRoutes } from './modules/notifications/notifications.routes.js';
import { realtimeRoutes } from './modules/realtime/realtime.routes.js';
import { projectRoutes, workspaceProjectRoutes } from './modules/projects/projects.routes.js';
import { subtaskRoutes, taskSubtaskRoutes } from './modules/subtasks/subtasks.routes.js';
import { tagRoutes, workspaceTagRoutes } from './modules/tags/tags.routes.js';
import { projectTaskRoutes, taskRoutes, workspaceTaskRoutes } from './modules/tasks/tasks.routes.js';
import { workspaceRoutes } from './modules/workspaces/workspaces.routes.js';
import type { AppEnv } from './types.js';

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use(requestId());
  if (env.NODE_ENV !== 'test') app.use(logger());
  app.use(secureHeaders());
  app.use(
    '/api/*',
    cors({
      origin: env.WEB_ORIGIN,
      credentials: true,
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
      exposeHeaders: ['X-Request-Id', 'Retry-After'],
      maxAge: 600,
    }),
  );
  // JSON dibatasi 1 MB; upload lampiran memakai batas MAX_UPLOAD_MB (+ overhead multipart).
  const jsonLimit = bodyLimit({
    maxSize: 1024 * 1024,
    onError: () => {
      throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body exceeds 1 MB');
    },
  });
  const uploadLimit = bodyLimit({
    maxSize: env.MAX_UPLOAD_MB * 1024 * 1024 + 64 * 1024,
    onError: () => {
      throw new AppError(413, 'PAYLOAD_TOO_LARGE', `File exceeds ${env.MAX_UPLOAD_MB} MB`);
    },
  });
  app.use('/api/*', (c, next) =>
    c.req.method === 'POST' && /\/tasks\/[^/]+\/attachments$/.test(c.req.path) ? uploadLimit(c, next) : jsonLimit(c, next),
  );

  app.get('/health', async (c) => {
    await db.execute(sql`SELECT 1`);
    return ok(c, { status: 'ok', database: 'up' });
  });

  const v1 = new Hono<AppEnv>();
  for (const prefix of ['workspaces', 'projects', 'tasks', 'subtasks', 'comments', 'milestones', 'tags', 'attachments']) {
    v1.use(`/${prefix}/*`, requireAuth);
  }
  v1.route('/auth', authRoutes);

  v1.route('/workspaces', workspaceRoutes);
  v1.route('/workspaces/:workspaceId/projects', workspaceProjectRoutes);
  v1.route('/workspaces/:workspaceId/tags', workspaceTagRoutes);
  v1.route('/workspaces/:workspaceId/activity', workspaceActivityRoutes);
  v1.route('/workspaces/:workspaceId/dashboard', workspaceDashboardRoutes);
  v1.route('/workspaces/:workspaceId/tasks', workspaceTaskRoutes);
  v1.route('/workspaces/:workspaceId/milestones', workspaceMilestoneRoutes);
  v1.route('/workspaces/:workspaceId/workload', workspaceWorkloadRoutes);
  v1.route('/workspaces/:workspaceId/reports', workspaceReportRoutes);
  v1.route('/workspaces/:workspaceId/notifications', workspaceNotificationRoutes);
  v1.route('/events', realtimeRoutes);

  v1.route('/projects', projectRoutes);
  v1.route('/projects/:projectId/tasks', projectTaskRoutes);
  v1.route('/projects/:projectId/milestones', projectMilestoneRoutes);
  v1.route('/projects/:projectId/activity', projectActivityRoutes);

  v1.route('/tasks', taskRoutes);
  v1.route('/tasks/:taskId/subtasks', taskSubtaskRoutes);
  v1.route('/tasks/:taskId/comments', taskCommentRoutes);
  v1.route('/tasks/:taskId/activity', taskActivityRoutes);
  v1.route('/tasks/:taskId/attachments', taskAttachmentRoutes);
  v1.route('/attachments', attachmentRoutes);

  v1.route('/subtasks', subtaskRoutes);
  v1.route('/comments', commentRoutes);
  v1.route('/milestones', milestoneRoutes);
  v1.route('/tags', tagRoutes);

  app.route('/api/v1', v1);
  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
