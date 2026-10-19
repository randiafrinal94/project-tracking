import {
  attachments,
  comments,
  milestones,
  projects,
  subtasks,
  tags,
  tasks,
  workspaceMembers,
  type MemberRole,
} from '@pt/db';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { createMiddleware } from 'hono/factory';
import { db } from '../db.js';
import { forbidden, notFound } from '../lib/errors.js';
import { isUuid } from '../lib/validate.js';
import type { AppEnv, Membership, Scope } from '../types.js';

const ROLE_RANK: Record<MemberRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

export const hasRole = (role: MemberRole, min: MemberRole) => ROLE_RANK[role] >= ROLE_RANK[min];

async function fetchMembership(workspaceId: string, userId: string): Promise<Membership | undefined> {
  const [membership] = await db
    .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return membership;
}

/**
 * Memastikan user adalah anggota workspace `:workspaceId` dengan role minimal `min`.
 * Non-anggota mendapat 404 agar keberadaan workspace tidak bocor.
 */
export const requireWorkspaceRole = (min: MemberRole) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const workspaceId = c.req.param('workspaceId');
    if (!isUuid(workspaceId)) throw notFound('Workspace');

    const membership = await fetchMembership(workspaceId, c.var.user.id);
    if (!membership) throw notFound('Workspace');
    if (!hasRole(membership.role, min)) throw forbidden();

    c.set('membership', membership);
    await next();
  });

/**
 * Memuat project aktif `:projectId` beserta role user di workspace pemiliknya.
 * Project terhapus (soft delete) atau milik workspace lain → 404.
 */
export const requireProjectRole = (min: MemberRole) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const projectId = c.req.param('projectId');
    if (!isUuid(projectId)) throw notFound('Project');

    const [row] = await db
      .select({ project: projects, role: workspaceMembers.role })
      .from(projects)
      .innerJoin(
        workspaceMembers,
        and(
          eq(workspaceMembers.workspaceId, projects.workspaceId),
          eq(workspaceMembers.userId, c.var.user.id),
        ),
      )
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .limit(1);

    if (!row) throw notFound('Project');
    if (!hasRole(row.role, min)) throw forbidden();

    c.set('project', row.project);
    c.set('membership', { workspaceId: row.project.workspaceId, role: row.role });
    c.set('scope', { workspaceId: row.project.workspaceId, projectId: row.project.id });
    await next();
  });

// ---------------------------------------------------------------------------
// Resource bertingkat (task, subtask, comment, milestone, tag)
// ---------------------------------------------------------------------------

type ScopedResource = 'task' | 'subtask' | 'comment' | 'milestone' | 'tag' | 'attachment';

const RESOURCE_LABEL: Record<ScopedResource, string> = {
  task: 'Task',
  subtask: 'Subtask',
  comment: 'Comment',
  milestone: 'Milestone',
  tag: 'Tag',
  attachment: 'Attachment',
};

const activeTaskAndProject = (extra?: SQL) =>
  and(isNull(tasks.deletedAt), isNull(projects.deletedAt), extra);

const loaders: Record<
  ScopedResource,
  (id: string, opts: { includeDeleted: boolean }) => Promise<Scope | undefined>
> = {
  task: async (id, { includeDeleted }) => {
    const [row] = await db
      .select({ workspaceId: projects.workspaceId, projectId: tasks.projectId, taskId: tasks.id })
      .from(tasks)
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(
        and(
          eq(tasks.id, id),
          isNull(projects.deletedAt),
          includeDeleted ? undefined : isNull(tasks.deletedAt),
        ),
      )
      .limit(1);
    return row;
  },
  subtask: async (id) => {
    const [row] = await db
      .select({ workspaceId: projects.workspaceId, projectId: tasks.projectId, taskId: tasks.id })
      .from(subtasks)
      .innerJoin(tasks, eq(tasks.id, subtasks.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(activeTaskAndProject(eq(subtasks.id, id)))
      .limit(1);
    return row;
  },
  comment: async (id) => {
    const [row] = await db
      .select({
        workspaceId: projects.workspaceId,
        projectId: tasks.projectId,
        taskId: tasks.id,
        ownerId: comments.authorId,
      })
      .from(comments)
      .innerJoin(tasks, eq(tasks.id, comments.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(activeTaskAndProject(and(eq(comments.id, id), isNull(comments.deletedAt))))
      .limit(1);
    return row;
  },
  milestone: async (id) => {
    const [row] = await db
      .select({ workspaceId: projects.workspaceId, projectId: milestones.projectId })
      .from(milestones)
      .innerJoin(projects, eq(projects.id, milestones.projectId))
      .where(and(eq(milestones.id, id), isNull(projects.deletedAt)))
      .limit(1);
    return row;
  },
  tag: async (id) => {
    const [row] = await db
      .select({ workspaceId: tags.workspaceId })
      .from(tags)
      .where(eq(tags.id, id))
      .limit(1);
    return row;
  },
  attachment: async (id) => {
    const [row] = await db
      .select({
        workspaceId: projects.workspaceId,
        projectId: tasks.projectId,
        taskId: tasks.id,
        ownerId: attachments.uploadedBy,
      })
      .from(attachments)
      .innerJoin(tasks, eq(tasks.id, attachments.taskId))
      .innerJoin(projects, eq(projects.id, tasks.projectId))
      .where(activeTaskAndProject(eq(attachments.id, id)))
      .limit(1);
    return row;
  },
};

/**
 * Memuat resource dari route param `:<resource>Id`, menurunkan workspace pemiliknya,
 * lalu memeriksa role user. Hasil disimpan di `c.var.scope` dan `c.var.membership`.
 */
export const requireScopedRole = (
  resource: ScopedResource,
  min: MemberRole,
  opts: { includeDeleted?: boolean } = {},
) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const id = c.req.param(`${resource}Id`);
    const label = RESOURCE_LABEL[resource];
    if (!isUuid(id)) throw notFound(label);

    const scope = await loaders[resource](id, { includeDeleted: opts.includeDeleted ?? false });
    if (!scope) throw notFound(label);

    const membership = await fetchMembership(scope.workspaceId, c.var.user.id);
    if (!membership) throw notFound(label);
    if (!hasRole(membership.role, min)) throw forbidden();

    c.set('scope', { ...scope, resourceId: id });
    c.set('membership', membership);
    await next();
  });
