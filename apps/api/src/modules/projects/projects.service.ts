import { projects, tasks, type Project } from '@pt/db';
import { and, asc, eq, getTableColumns, isNotNull, isNull, sql, type SQL } from 'drizzle-orm';
import { db } from '../../db.js';
import { withActor } from '../../lib/actor.js';
import { notFound } from '../../lib/errors.js';
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from './projects.schemas.js';

/** Agregat task aktif per project untuk kartu project & dashboard. */
const taskStats = db
  .select({
    projectId: tasks.projectId,
    total: sql<number>`count(*)`.as('total'),
    completed: sql<number>`count(*) FILTER (WHERE ${tasks.status} = 'done')`.as('completed'),
    overdue: sql<number>`count(*) FILTER (
      WHERE ${tasks.status} <> 'done' AND ${tasks.dueDate} < CURRENT_DATE
    )`.as('overdue'),
  })
  .from(tasks)
  .where(isNull(tasks.deletedAt))
  .groupBy(tasks.projectId)
  .as('task_stats');

const coalesceCount = (column: SQL.Aliased<number>) =>
  sql<number>`coalesce(${column}, 0)`.mapWith(Number);

function withStats(row: Project & { totalTasks: number; completedTasks: number; overdueTasks: number }) {
  const { totalTasks, completedTasks, overdueTasks, ...project } = row;
  return {
    ...project,
    stats: {
      totalTasks,
      completedTasks,
      overdueTasks,
      completionRate: totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
    },
  };
}

function selectWithStats(where: SQL | undefined) {
  return db
    .select({
      ...getTableColumns(projects),
      totalTasks: coalesceCount(taskStats.total),
      completedTasks: coalesceCount(taskStats.completed),
      overdueTasks: coalesceCount(taskStats.overdue),
    })
    .from(projects)
    .leftJoin(taskStats, eq(taskStats.projectId, projects.id))
    .where(where)
    .orderBy(asc(projects.name));
}

export async function list(workspaceId: string, query: ListProjectsQuery) {
  const rows = await selectWithStats(
    and(
      eq(projects.workspaceId, workspaceId),
      query.archived ? isNotNull(projects.deletedAt) : isNull(projects.deletedAt),
      query.status ? eq(projects.status, query.status) : undefined,
    ),
  );
  return rows.map(withStats);
}

export async function get(projectId: string) {
  const [row] = await selectWithStats(and(eq(projects.id, projectId), isNull(projects.deletedAt)));
  if (!row) throw notFound('Project');
  return withStats(row);
}

export async function create(actorId: string, workspaceId: string, input: CreateProjectInput) {
  const [project] = await withActor(actorId, (tx) =>
    tx
      .insert(projects)
      .values({ ...input, workspaceId, createdBy: actorId })
      .returning({ id: projects.id }),
  );
  return get(project!.id);
}

export async function update(actorId: string, projectId: string, input: UpdateProjectInput) {
  await withActor(actorId, (tx) => tx.update(projects).set(input).where(eq(projects.id, projectId)));
  return get(projectId);
}

/** Soft delete; task di dalamnya ikut tersembunyi karena akses task melalui project aktif. */
export async function softDelete(actorId: string, projectId: string) {
  const [row] = await withActor(actorId, (tx) =>
    tx
      .update(projects)
      .set({ deletedAt: new Date() })
      .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
      .returning({ id: projects.id, deletedAt: projects.deletedAt }),
  );
  if (!row) throw notFound('Project');
  return row;
}

export async function restore(actorId: string, workspaceId: string, projectId: string) {
  const [row] = await withActor(actorId, (tx) =>
    tx
      .update(projects)
      .set({ deletedAt: null })
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.workspaceId, workspaceId),
          isNotNull(projects.deletedAt),
        ),
      )
      .returning({ id: projects.id }),
  );
  if (!row) throw notFound('Archived project');
  return get(row.id);
}
