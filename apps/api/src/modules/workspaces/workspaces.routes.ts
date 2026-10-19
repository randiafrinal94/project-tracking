import { Hono } from 'hono';
import { ok } from '../../lib/response.js';
import { validate } from '../../lib/validate.js';
import { requireWorkspaceRole } from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';
import {
  addMemberSchema,
  createWorkspaceSchema,
  memberParamsSchema,
  updateMemberSchema,
  updateWorkspaceSchema,
} from './workspaces.schemas.js';
import * as workspaces from './workspaces.service.js';

/** Dipasang di `/api/v1/workspaces`; `requireAuth` diterapkan di router v1. */
export const workspaceRoutes = new Hono<AppEnv>()
  .get('/', async (c) => ok(c, await workspaces.listForUser(c.var.user.id)))
  .post('/', validate('json', createWorkspaceSchema), async (c) =>
    ok(c, await workspaces.create(c.var.user.id, c.req.valid('json')), 201),
  )
  .get('/:workspaceId', requireWorkspaceRole('viewer'), async (c) =>
    ok(c, await workspaces.get(c.var.membership)),
  )
  .patch(
    '/:workspaceId',
    requireWorkspaceRole('admin'),
    validate('json', updateWorkspaceSchema),
    async (c) => ok(c, await workspaces.update(c.var.membership, c.req.valid('json'))),
  )
  .delete('/:workspaceId', requireWorkspaceRole('owner'), async (c) => {
    await workspaces.remove(c.var.membership.workspaceId);
    return ok(c, { id: c.var.membership.workspaceId, deleted: true });
  })

  // --- Members -------------------------------------------------------------
  .get('/:workspaceId/members', requireWorkspaceRole('viewer'), async (c) =>
    ok(c, await workspaces.listMembers(c.var.membership.workspaceId)),
  )
  .post(
    '/:workspaceId/members',
    requireWorkspaceRole('admin'),
    validate('json', addMemberSchema),
    async (c) => ok(c, await workspaces.addMember(c.var.membership, c.req.valid('json')), 201),
  )
  .patch(
    '/:workspaceId/members/:userId',
    requireWorkspaceRole('admin'),
    validate('param', memberParamsSchema),
    validate('json', updateMemberSchema),
    async (c) => {
      const actor = { ...c.var.membership, userId: c.var.user.id };
      const { userId } = c.req.valid('param');
      return ok(c, await workspaces.updateMemberRole(actor, userId, c.req.valid('json').role));
    },
  )
  .delete(
    '/:workspaceId/members/:userId',
    requireWorkspaceRole('viewer'),
    validate('param', memberParamsSchema),
    async (c) => {
      const actor = { ...c.var.membership, userId: c.var.user.id };
      const { userId } = c.req.valid('param');
      await workspaces.removeMember(actor, userId);
      return ok(c, { userId, removed: true });
    },
  );
