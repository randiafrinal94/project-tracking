import { Hono, type Context } from 'hono';
import { forbidden } from '../../lib/errors.js';
import { ok } from '../../lib/response.js';
import { validate } from '../../lib/validate.js';
import {
  isAssigneeScoped,
  requireProjectRole,
  requireScopedRole,
  requireWorkspaceRole,
} from '../../middleware/access.js';
import type { AppEnv } from '../../types.js';
import {
  createTaskSchema,
  listTasksQuerySchema,
  moveTaskSchema,
  setTagsSchema,
  updateTaskSchema,
} from './tasks.schemas.js';
import * as tasks from './tasks.service.js';

/** Scope task selalu lengkap setelah `requireScopedRole('task', ...)`. */
const taskScope = (c: Context<AppEnv>): tasks.TaskScope => ({
  workspaceId: c.var.scope.workspaceId,
  projectId: c.var.scope.projectId!,
  taskId: c.var.scope.taskId!,
});

/** Penonton daftar task: member hanya melihat task yang di-assign kepadanya. */
const listViewer = (c: Context<AppEnv>): tasks.ListViewer => ({
  userId: c.var.user.id,
  assignedOnly: isAssigneeScoped(c.var.membership.role),
});

/** Dipasang di `/api/v1/projects/:projectId/tasks`. Membuat task: admin+. */
export const projectTaskRoutes = new Hono<AppEnv>()
  .get('/', requireProjectRole('viewer'), validate('query', listTasksQuerySchema), async (c) =>
    ok(c, await tasks.list({ projectId: c.var.project.id }, listViewer(c), c.req.valid('query'))),
  )
  .post('/', requireProjectRole('admin'), validate('json', createTaskSchema), async (c) =>
    ok(c, await tasks.create(c.var.user.id, c.var.project, c.req.valid('json')), 201),
  );

/** Dipasang di `/api/v1/workspaces/:workspaceId/tasks` — daftar lintas project (halaman Tasks). */
export const workspaceTaskRoutes = new Hono<AppEnv>().get(
  '/',
  requireWorkspaceRole('viewer'),
  validate('query', listTasksQuerySchema),
  async (c) => ok(c, await tasks.list({ workspaceId: c.var.membership.workspaceId }, listViewer(c), c.req.valid('query'))),
);

/**
 * Dipasang di `/api/v1/tasks`. Member hanya mengakses task yang di-assign kepadanya
 * (dicek `requireScopedRole`) dan tidak dapat mengubah assignee; hapus: admin+.
 */
export const taskRoutes = new Hono<AppEnv>()
  .get('/:taskId', requireScopedRole('task', 'viewer'), async (c) =>
    ok(c, await tasks.get(taskScope(c).taskId)),
  )
  .patch('/:taskId', requireScopedRole('task', 'member'), validate('json', updateTaskSchema), async (c) => {
    const input = c.req.valid('json');
    if (input.assigneeId !== undefined && isAssigneeScoped(c.var.membership.role)) {
      throw forbidden('Only admins can change the assignee');
    }
    return ok(c, await tasks.update(c.var.user.id, taskScope(c), input));
  })
  .patch('/:taskId/move', requireScopedRole('task', 'member'), validate('json', moveTaskSchema), async (c) =>
    ok(c, await tasks.move(c.var.user.id, taskScope(c), c.req.valid('json'))),
  )
  .put('/:taskId/tags', requireScopedRole('task', 'member'), validate('json', setTagsSchema), async (c) =>
    ok(c, await tasks.setTags(c.var.user.id, taskScope(c), c.req.valid('json').tagIds)),
  )
  .delete('/:taskId', requireScopedRole('task', 'admin'), async (c) =>
    ok(c, await tasks.softDelete(c.var.user.id, taskScope(c).taskId)),
  )
  .post('/:taskId/restore', requireScopedRole('task', 'admin', { includeDeleted: true }), async (c) =>
    ok(c, await tasks.restore(c.var.user.id, taskScope(c))),
  );
