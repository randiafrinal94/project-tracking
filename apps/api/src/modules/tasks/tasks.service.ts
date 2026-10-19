import {
  attachments,
  comments,
  milestones,
  projects,
  subtasks,
  tags,
  taskTags,
  tasks,
  users,
  workspaceMembers,
  type Project,
  type TaskStatus,
} from '@pt/db';
import {
  and,
  asc,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { db } from '../../db.js';
import { lockProjectOrdering, withActor, type Tx } from '../../lib/actor.js';
import { AppError, notFound } from '../../lib/errors.js';
import { decodeCursor, encodeCursor, toPage } from '../../lib/pagination.js';
import { notify } from '../../lib/notify.js';
import { sanitizeRichText } from '../../lib/sanitize.js';
import { outer } from '../../lib/sql.js';
import type {
  CreateTaskInput,
  ListTasksQuery,
  MoveTaskInput,
  UpdateTaskInput,
} from './tasks.schemas.js';
import { resolveSortOrder } from './tasks.ordering.js';

const assignee = alias(users, 'assignee');
const reporter = alias(users, 'reporter');

const toHours = (v: string | null) => (v === null ? null : Number(v));

/** Kolom ringkas untuk kartu Kanban (DESIGN.md §3.2). */
const cardColumns = {
  id: tasks.id,
  projectId: tasks.projectId,
  milestoneId: tasks.milestoneId,
  taskNumber: tasks.taskNumber,
  key: sql<string>`${projects.keyPrefix} || '-' || ${tasks.taskNumber}`,
  projectName: projects.name,
  title: tasks.title,
  status: tasks.status,
  priority: tasks.priority,
  sortOrder: tasks.sortOrder,
  startDate: tasks.startDate,
  dueDate: tasks.dueDate,
  estimateHours: tasks.estimateHours,
  actualHours: tasks.actualHours,
  completedAt: tasks.completedAt,
  createdAt: tasks.createdAt,
  updatedAt: tasks.updatedAt,
  assigneeId: assignee.id,
  assigneeName: assignee.fullName,
  assigneeAvatarUrl: assignee.avatarUrl,
  tags: sql<{ id: string; name: string; color: string }[]>`coalesce((
    SELECT json_agg(json_build_object('id', g.id, 'name', g.name, 'color', g.color) ORDER BY g.name)
      FROM ${taskTags} tt JOIN ${tags} g ON g.id = tt.tag_id
     WHERE tt.task_id = ${outer(tasks.id)}
  ), '[]'::json)`,
  subtaskTotal: sql<number>`(SELECT count(*) FROM ${subtasks} s WHERE s.task_id = ${outer(tasks.id)})`.mapWith(Number),
  subtaskCompleted: sql<number>`(
    SELECT count(*) FROM ${subtasks} s WHERE s.task_id = ${outer(tasks.id)} AND s.is_completed
  )`.mapWith(Number),
  commentCount: sql<number>`(
    SELECT count(*) FROM ${comments} c WHERE c.task_id = ${outer(tasks.id)} AND c.deleted_at IS NULL
  )`.mapWith(Number),
  attachmentCount: sql<number>`(SELECT count(*) FROM ${attachments} a WHERE a.task_id = ${outer(tasks.id)})`.mapWith(Number),
};

const selectCards = () =>
  db
    .select(cardColumns)
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId));

type CardRow = Awaited<ReturnType<typeof selectCards>>[number];

export type TaskScope = { workspaceId: string; projectId: string; taskId: string };

/** `assignedOnly` → hanya task yang assignee-nya `userId` (role member). */
export type ListViewer = { userId: string; assignedOnly: boolean };

function toCard(row: CardRow) {
  const { assigneeId, assigneeName, assigneeAvatarUrl, subtaskTotal, subtaskCompleted, ...rest } = row;
  return {
    ...rest,
    estimateHours: toHours(row.estimateHours),
    actualHours: Number(row.actualHours),
    assignee: assigneeId ? { id: assigneeId, fullName: assigneeName!, avatarUrl: assigneeAvatarUrl } : null,
    subtasks: { total: subtaskTotal, completed: subtaskCompleted },
  };
}

const STATUS_ORDER: TaskStatus[] = ['backlog', 'in_progress', 'in_review', 'done'];

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Daftar kartu, untuk satu project (board) atau seluruh workspace (halaman Tasks).
 * Default terurut (status, sort_order, id) dengan paginasi keyset sehingga kolom
 * > 200 task dapat dimuat bertahap (virtual scrolling).
 */
export async function list(
  scope: { projectId: string } | { workspaceId: string },
  viewer: ListViewer,
  query: ListTasksQuery,
) {
  const { userId } = viewer;
  const filters: (SQL | undefined)[] = [isNull(tasks.deletedAt)];
  if (viewer.assignedOnly) filters.push(eq(tasks.assigneeId, userId));
  if ('projectId' in scope) {
    filters.push(eq(tasks.projectId, scope.projectId));
  } else {
    filters.push(eq(projects.workspaceId, scope.workspaceId), isNull(projects.deletedAt));
    if (query.projectId) filters.push(eq(tasks.projectId, query.projectId));
  }

  if (query.status) filters.push(eq(tasks.status, query.status));
  if (query.priority) filters.push(inArray(tasks.priority, query.priority));
  if (query.assigneeId === 'me') filters.push(eq(tasks.assigneeId, userId));
  else if (query.assigneeId === 'unassigned') filters.push(isNull(tasks.assigneeId));
  else if (query.assigneeId) filters.push(eq(tasks.assigneeId, query.assigneeId));
  if (query.milestoneId === 'none') filters.push(isNull(tasks.milestoneId));
  else if (query.milestoneId) filters.push(eq(tasks.milestoneId, query.milestoneId));
  if (query.tagId) {
    filters.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(taskTags)
          .where(and(eq(taskTags.taskId, outer(tasks.id)), inArray(taskTags.tagId, query.tagId))),
      ),
    );
  }
  if (query.overdue !== undefined) {
    const overdue = and(ne(tasks.status, 'done'), lt(tasks.dueDate, sql`CURRENT_DATE`));
    filters.push(query.overdue ? overdue : sql`NOT coalesce(${overdue}, false)`);
  }
  if (query.q) {
    const keyMatch = query.q.match(/^([A-Za-z][A-Za-z0-9]{1,9})-(\d+)$/);
    const pattern = `%${query.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    filters.push(
      keyMatch
        ? or(ilike(tasks.title, pattern), eq(tasks.taskNumber, Number(keyMatch[2])))
        : ilike(tasks.title, pattern),
    );
  }
  // Total (tanpa cursor) untuk counter kolom & "Load more (N left)".
  const matching = and(...filters);

  let pageFilter: SQL | undefined;
  if (query.cursor) {
    const { order, id } = decodeCursor(query.cursor);
    const [status, sort] = order.split('|');
    if (!STATUS_ORDER.includes(status as TaskStatus) || !/^-?\d+$/.test(sort ?? '')) {
      throw new AppError(400, 'INVALID_CURSOR', 'Invalid pagination cursor');
    }
    pageFilter = sql`(${tasks.status}, ${tasks.sortOrder}, ${tasks.id}) > (${status}::task_status, ${Number(sort)}, ${id}::uuid)`;
  }

  const countQuery = db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(matching);

  if (query.sort !== 'board') {
    // List view: urutan bebas + paginasi offset.
    const dir = query.dir === 'desc' ? desc : asc;
    const order: SQL[] = {
      due: [sql`${tasks.dueDate} ${sql.raw(query.dir === 'desc' ? 'DESC' : 'ASC')} NULLS LAST`],
      priority: [dir(tasks.priority)],
      updated: [dir(tasks.updatedAt)],
      created: [dir(tasks.createdAt)],
      title: [dir(sql`lower(${tasks.title})`)],
      key: [dir(projects.keyPrefix), dir(tasks.taskNumber)],
    }[query.sort];
    const [rows, [counted]] = await Promise.all([
      selectCards()
        .where(matching)
        .orderBy(...order, asc(tasks.id))
        .limit(query.limit)
        .offset(query.offset),
      countQuery,
    ]);
    const total = counted?.total ?? 0;
    const nextOffset = query.offset + rows.length < total ? query.offset + rows.length : null;
    return { items: rows.map(toCard), nextCursor: null, nextOffset, total };
  }

  const [rows, [counted]] = await Promise.all([
    selectCards()
      .where(and(matching, pageFilter))
      .orderBy(asc(tasks.status), asc(tasks.sortOrder), asc(tasks.id))
      .limit(query.limit + 1),
    countQuery,
  ]);

  const page = toPage(rows, query.limit, (r) => encodeCursor(`${r.status}|${r.sortOrder}`, r.id));
  return { items: page.items.map(toCard), nextCursor: page.nextCursor, nextOffset: null, total: counted?.total ?? 0 };
}

export async function get(taskId: string, { includeDeleted = false } = {}) {
  const [row] = await db
    .select({
      ...cardColumns,
      description: tasks.description,
      deletedAt: tasks.deletedAt,
      reporterId: reporter.id,
      reporterName: reporter.fullName,
      reporterAvatarUrl: reporter.avatarUrl,
      milestoneName: milestones.name,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .leftJoin(assignee, eq(assignee.id, tasks.assigneeId))
    .leftJoin(reporter, eq(reporter.id, tasks.reporterId))
    .leftJoin(milestones, eq(milestones.id, tasks.milestoneId))
    .where(and(eq(tasks.id, taskId), includeDeleted ? undefined : isNull(tasks.deletedAt)))
    .limit(1);
  if (!row) throw notFound('Task');

  const checklist = await db
    .select({
      id: subtasks.id,
      title: subtasks.title,
      isCompleted: subtasks.isCompleted,
      completedAt: subtasks.completedAt,
      sortOrder: subtasks.sortOrder,
    })
    .from(subtasks)
    .where(eq(subtasks.taskId, taskId))
    .orderBy(asc(subtasks.sortOrder), asc(subtasks.createdAt));

  const { reporterId, reporterName, reporterAvatarUrl, milestoneName, description, deletedAt, ...card } = row;
  return {
    ...toCard(card),
    description,
    deletedAt,
    reporter: reporterId ? { id: reporterId, fullName: reporterName!, avatarUrl: reporterAvatarUrl } : null,
    milestone: row.milestoneId ? { id: row.milestoneId, name: milestoneName! } : null,
    checklist,
  };
}

// ---------------------------------------------------------------------------
// Validasi referensi lintas entitas
// ---------------------------------------------------------------------------

const invalidReference = (field: string, message: string) =>
  new AppError(422, 'INVALID_REFERENCE', message, [{ path: field, message }]);

async function assertReferences(
  tx: Tx,
  scope: { workspaceId: string; projectId: string },
  refs: { assigneeId?: string | null; milestoneId?: string | null; tagIds?: string[] },
) {
  if (refs.assigneeId) {
    const [member] = await tx
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, scope.workspaceId),
          eq(workspaceMembers.userId, refs.assigneeId),
          ne(workspaceMembers.role, 'viewer'),
        ),
      )
      .limit(1);
    if (!member) {
      throw invalidReference('assigneeId', 'Assignee must be a non-viewer member of this workspace');
    }
  }
  if (refs.milestoneId) {
    const [milestone] = await tx
      .select({ id: milestones.id })
      .from(milestones)
      .where(and(eq(milestones.id, refs.milestoneId), eq(milestones.projectId, scope.projectId)))
      .limit(1);
    if (!milestone) throw invalidReference('milestoneId', 'Milestone does not belong to this project');
  }
  if (refs.tagIds?.length) {
    const found = await tx
      .select({ id: tags.id })
      .from(tags)
      .where(and(inArray(tags.id, refs.tagIds), eq(tags.workspaceId, scope.workspaceId)));
    if (found.length !== refs.tagIds.length) {
      throw invalidReference('tagIds', 'One or more tags do not belong to this workspace');
    }
  }
}

const normalizeDescription = (description: string | null | undefined) => {
  if (description === undefined) return undefined;
  if (description === null) return null;
  const clean = sanitizeRichText(description);
  return clean === '' ? null : clean;
};

const toNumeric = (v: number | null | undefined) =>
  v === undefined ? undefined : v === null ? null : v.toFixed(2);

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function create(actorId: string, project: Project, input: CreateTaskInput) {
  const { tagIds, ...fields } = input;
  const scope = { workspaceId: project.workspaceId, projectId: project.id };

  const taskId = await withActor(actorId, async (tx) => {
    await assertReferences(tx, scope, { ...fields, tagIds });
    await lockProjectOrdering(tx, project.id);
    const { sortOrder } = await resolveSortOrder(tx, project.id, fields.status, null, {});

    const [task] = await tx
      .insert(tasks)
      .values({
        ...fields,
        projectId: project.id,
        reporterId: actorId,
        description: normalizeDescription(fields.description),
        estimateHours: toNumeric(fields.estimateHours),
        sortOrder,
      })
      .returning({ id: tasks.id, taskNumber: tasks.taskNumber });

    if (tagIds.length > 0) {
      await tx.insert(taskTags).values(tagIds.map((tagId) => ({ taskId: task!.id, tagId })));
    }
    if (fields.assigneeId) {
      await notifyAssigned(tx, actorId, fields.assigneeId, {
        ...scope,
        taskId: task!.id,
        key: `${project.keyPrefix}-${task!.taskNumber}`,
        title: fields.title,
      });
    }
    return task!.id;
  });

  return get(taskId);
}

/** Notifikasi "ditugaskan" (dilewati bila menugaskan diri sendiri). */
async function notifyAssigned(
  tx: Tx,
  actorId: string,
  assigneeId: string,
  t: { workspaceId: string; projectId: string; taskId: string; key: string; title: string },
) {
  await notify(tx, actorId, [
    {
      userId: assigneeId,
      workspaceId: t.workspaceId,
      projectId: t.projectId,
      taskId: t.taskId,
      type: 'task.assigned',
      metadata: { key: t.key, title: t.title },
    },
  ]);
}

export async function update(actorId: string, scope: TaskScope, input: UpdateTaskInput) {
  await withActor(actorId, async (tx) => {
    await assertReferences(tx, scope, input);
    const [before] = await tx
      .select({ assigneeId: tasks.assigneeId })
      .from(tasks)
      .where(eq(tasks.id, scope.taskId))
      .limit(1);
    const [after] = await tx
      .update(tasks)
      .set({
        ...input,
        description: normalizeDescription(input.description),
        estimateHours: toNumeric(input.estimateHours),
        actualHours: toNumeric(input.actualHours) ?? undefined,
      })
      .where(eq(tasks.id, scope.taskId))
      .returning({ title: tasks.title, taskNumber: tasks.taskNumber });

    if (input.assigneeId && input.assigneeId !== before?.assigneeId) {
      const [project] = await tx
        .select({ keyPrefix: projects.keyPrefix })
        .from(projects)
        .where(eq(projects.id, scope.projectId))
        .limit(1);
      await notifyAssigned(tx, actorId, input.assigneeId, {
        ...scope,
        key: `${project!.keyPrefix}-${after!.taskNumber}`,
        title: after!.title,
      });
    }
  });
  return get(scope.taskId);
}

/**
 * Pindah kartu antar/di dalam kolom (drag-and-drop). Dikunci per project agar
 * dua drag bersamaan tidak menghasilkan sort_order yang bertabrakan.
 */
export async function move(actorId: string, scope: TaskScope, input: MoveTaskInput) {
  if (input.prevTaskId === scope.taskId || input.nextTaskId === scope.taskId) {
    throw new AppError(422, 'INVALID_PLACEMENT', 'A task cannot be placed relative to itself');
  }

  const result = await withActor(actorId, async (tx) => {
    await lockProjectOrdering(tx, scope.projectId);
    const placement = await resolveSortOrder(tx, scope.projectId, input.status, scope.taskId, input);
    await tx
      .update(tasks)
      .set({ status: input.status, sortOrder: placement.sortOrder })
      .where(eq(tasks.id, scope.taskId));
    return placement;
  });

  return { task: await get(scope.taskId), rebalanced: result.rebalanced };
}

export async function setTags(actorId: string, scope: TaskScope, tagIds: string[]) {
  await withActor(actorId, async (tx) => {
    await assertReferences(tx, scope, { tagIds });
    await tx
      .delete(taskTags)
      .where(
        and(
          eq(taskTags.taskId, scope.taskId),
          tagIds.length > 0 ? notInArray(taskTags.tagId, tagIds) : undefined,
        ),
      );
    if (tagIds.length > 0) {
      await tx
        .insert(taskTags)
        .values(tagIds.map((tagId) => ({ taskId: scope.taskId, tagId })))
        .onConflictDoNothing();
    }
  });
  return get(scope.taskId);
}

export async function softDelete(actorId: string, taskId: string) {
  const [row] = await withActor(actorId, (tx) =>
    tx
      .update(tasks)
      .set({ deletedAt: new Date() })
      .where(and(eq(tasks.id, taskId), isNull(tasks.deletedAt)))
      .returning({ id: tasks.id, deletedAt: tasks.deletedAt }),
  );
  if (!row) throw notFound('Task');
  return row;
}

/** Task yang dipulihkan ditaruh di akhir kolomnya agar tidak bentrok dengan urutan baru. */
export async function restore(actorId: string, scope: TaskScope) {
  await withActor(actorId, async (tx) => {
    const [task] = await tx
      .select({ status: tasks.status })
      .from(tasks)
      .where(and(eq(tasks.id, scope.taskId), isNotNull(tasks.deletedAt)))
      .limit(1);
    if (!task) throw notFound('Deleted task');

    await lockProjectOrdering(tx, scope.projectId);
    const { sortOrder } = await resolveSortOrder(tx, scope.projectId, task.status, scope.taskId, {});
    await tx.update(tasks).set({ deletedAt: null, sortOrder }).where(eq(tasks.id, scope.taskId));
  });
  return get(scope.taskId);
}
