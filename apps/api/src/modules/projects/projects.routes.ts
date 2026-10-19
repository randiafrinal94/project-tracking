import { Hono } from 'hono';
import { ok } from '../../lib/response.js';
import { validate } from '../../lib/validate.js';
import { requireProjectRole, requireWorkspaceRole } from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  restoreParamsSchema,
  updateProjectSchema,
} from './projects.schemas.js';
import * as projects from './projects.service.js';

/** Dipasang di `/api/v1/workspaces/:workspaceId/projects`. */
export const workspaceProjectRoutes = new Hono<AppEnv>()
  .get('/', requireWorkspaceRole('viewer'), validate('query', listProjectsQuerySchema), async (c) =>
    ok(c, await projects.list(c.var.membership.workspaceId, c.req.valid('query'))),
  )
  .post('/', requireWorkspaceRole('admin'), validate('json', createProjectSchema), async (c) =>
    ok(
      c,
      await projects.create(c.var.user.id, c.var.membership.workspaceId, c.req.valid('json')),
      201,
    ),
  )
  .post(
    '/:projectId/restore',
    requireWorkspaceRole('admin'),
    validate('param', restoreParamsSchema),
    async (c) =>
      ok(
        c,
        await projects.restore(
          c.var.user.id,
          c.var.membership.workspaceId,
          c.req.valid('param').projectId,
        ),
      ),
  );

/** Dipasang di `/api/v1/projects`. */
export const projectRoutes = new Hono<AppEnv>()
  .get('/:projectId', requireProjectRole('viewer'), async (c) =>
    ok(c, await projects.get(c.var.project.id)),
  )
  .patch(
    '/:projectId',
    requireProjectRole('admin'),
    validate('json', updateProjectSchema),
    async (c) => ok(c, await projects.update(c.var.user.id, c.var.project.id, c.req.valid('json'))),
  )
  .delete('/:projectId', requireProjectRole('admin'), async (c) =>
    ok(c, await projects.softDelete(c.var.user.id, c.var.project.id)),
  );
