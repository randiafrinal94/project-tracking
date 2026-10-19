'use client';

import { useQueries } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { MetaDot, PageHeader } from '@/components/layout/page-header';
import { MilestoneItem } from '@/components/milestones/milestone-item';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { ProjectRow, ProjectRowSkeleton } from '@/components/projects/project-row';
import { Pill } from '@/components/ui/badge';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { KpiCard, KpiTrend } from '@/components/ui/kpi-card';
import { ProgressBar } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useDashboard, useProjects, useWorkload, useWorkspaceActivity, useWorkspaceDetail } from '@/hooks/queries';
import { WorkloadRow } from '@/components/workload/workload-list';
import { useWorkspace } from '@/hooks/use-workspace';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { Milestone } from '@/lib/types';

export default function DashboardPage() {
  const workspace = useWorkspace();
  const detail = useWorkspaceDetail(workspace.id);
  const dashboard = useDashboard(workspace.id);
  const projects = useProjects(workspace.id);
  const activity = useWorkspaceActivity(workspace.id);
  const workload = useWorkload(workspace.id);
  const [createOpen, setCreateOpen] = useState(false);

  const activeProjects = (projects.data ?? []).filter((p) => p.status === 'active');
  const projectsAtRisk = (projects.data ?? []).filter((p) => p.stats.overdueTasks > 0);
  const mostOverdue = [...projectsAtRisk].sort((a, b) => b.stats.overdueTasks - a.stats.overdueTasks)[0];

  // Milestone mendatang dari project aktif (maks. 6 project agar ringan).
  const milestoneQueries = useQueries({
    queries: activeProjects.slice(0, 6).map((p) => ({
      queryKey: qk.milestones(p.id),
      queryFn: () => api<Milestone[]>(`/projects/${p.id}/milestones`),
    })),
  });
  const upcoming = milestoneQueries
    .flatMap((q, i) => (q.data ?? []).map((m) => ({ m, project: activeProjects[i]! })))
    .filter(({ m }) => !m.isCompleted)
    .sort((a, b) => (a.m.dueDate ?? '9999').localeCompare(b.m.dueDate ?? '9999'))
    .slice(0, 3);
  const milestonesLoading = projects.isLoading || milestoneQueries.some((q) => q.isLoading);

  const d = dashboard.data;
  const weeklyDelta =
    d && d.completedTasksLastWeek > 0
      ? Math.round(((d.completedTasksThisWeek - d.completedTasksLastWeek) / d.completedTasksLastWeek) * 100)
      : null;

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        icon="space_dashboard"
        title={`${workspace.name} Overview`}
        badge={
          d && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-fixed px-space-sm py-0.5 text-label-sm text-on-tertiary-fixed shadow-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-tertiary-container" />
              {d.activeProjects} active project{d.activeProjects === 1 ? '' : 's'}
            </span>
          )
        }
        meta={
          detail.data ? (
            <>
              <span className="flex items-center gap-1.5 rounded-md bg-surface-container px-2 py-0.5">
                <Icon name="group" size={14} />
                {detail.data.memberCount} members
              </span>
              <MetaDot />
              <span>
                Your role: <strong className="text-label-md text-on-surface capitalize">{workspace.role}</strong>
              </span>
              <MetaDot />
              <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-code-inline text-on-surface">
                {workspace.slug}
              </span>
            </>
          ) : (
            <Skeleton className="h-5 w-64" />
          )
        }
        actions={
          <>
            <ButtonLink href={`/${workspace.slug}/projects`} icon="folder_open">
              All projects
            </ButtonLink>
            {workspace.can('admin') && (
              <Button variant="primary" icon="add" onClick={() => setCreateOpen(true)}>
                New project
              </Button>
            )}
          </>
        }
      />

      {/* KPI — PRD §3.5 */}
      {dashboard.isError ? (
        <Card className="mb-space-xl">
          <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} title="Could not load metrics" />
        </Card>
      ) : (
        <section aria-label="Key metrics" className="mb-space-xl grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            loading={!d}
            label="Active Projects"
            icon="folder_copy"
            value={d?.activeProjects}
            aside={d && <span className="text-label-sm text-on-surface-variant">of {d.totalProjects} total</span>}
            description={
              <p className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${projectsAtRisk.length ? 'bg-error' : 'bg-tertiary-container'}`} />
                <span>
                  {projectsAtRisk.length
                    ? `${projectsAtRisk.length} project${projectsAtRisk.length === 1 ? '' : 's'} with overdue work`
                    : 'All projects on schedule'}
                </span>
              </p>
            }
          />
          <KpiCard
            loading={!d}
            label="Tasks Completed"
            icon="task_alt"
            iconTone="success"
            value={
              d && (
                <>
                  {d.completedTasksThisWeek}{' '}
                  <span className="text-headline-md text-on-surface-variant">this week</span>
                </>
              )
            }
            aside={weeklyDelta !== null && <KpiTrend value={weeklyDelta} suffix="% vs lw" />}
            description={d && `Last week: ${d.completedTasksLastWeek} completed`}
            footer={
              d && (
                <>
                  <ProgressBar
                    size="md"
                    tone="success"
                    value={d.totalTasks ? (d.tasksByStatus.done / d.totalTasks) * 100 : 0}
                    label="Tasks done overall"
                  />
                  <div className="mt-1 flex items-center justify-between text-[10px] font-semibold tracking-[0.04em] text-outline">
                    <span className="tabular">
                      {d.tasksByStatus.done} / {d.totalTasks} tasks done
                    </span>
                    <span className="text-tertiary-container">{d.tasksByStatus.in_review} in review</span>
                  </div>
                </>
              )
            }
          />
          <KpiCard
            loading={!d}
            label="Overdue Items"
            icon="warning"
            iconTone="danger"
            value={d?.overdueItems}
            valueClassName={d && d.overdueItems > 0 ? 'text-error' : undefined}
            aside={
              d &&
              (d.overdueItems > 0 ? (
                <Pill tone="danger" className="font-semibold">Immediate Action</Pill>
              ) : (
                <Pill tone="success" className="font-semibold">On track</Pill>
              ))
            }
            description={
              <p className="truncate">
                {mostOverdue ? `Most affected: ${mostOverdue.name}` : 'No tasks past their due date'}
              </p>
            }
            footer={
              mostOverdue && (
                <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-2">
                  <span className="truncate text-[11px] font-medium text-error">
                    {mostOverdue.keyPrefix} · {mostOverdue.stats.overdueTasks} overdue task{mostOverdue.stats.overdueTasks === 1 ? '' : 's'}
                  </span>
                  <ButtonLink href={`/${workspace.slug}/projects/${mostOverdue.id}`} variant="ghost" size="sm" className="h-6 px-1.5 text-[11px]">
                    Open
                  </ButtonLink>
                </div>
              )
            }
          />
          <KpiCard
            loading={!d}
            label="Completion Rate"
            icon="timer"
            iconTone="primary"
            value={d && `${d.completionRate}%`}
            asideEnd
            aside={d && <span className="text-label-md font-semibold text-primary">{d.tasksByStatus.in_progress} in progress</span>}
            description="Share of all active tasks marked done"
            footer={
              d && (
                <>
                  <ProgressBar size="md" value={d.completionRate} label="Overall completion rate" />
                  <div className="mt-1 flex justify-between text-[10px] font-semibold tracking-[0.04em] text-outline">
                    <span className="tabular">{d.tasksByStatus.backlog} in backlog</span>
                    <span className="tabular">{d.totalTasks} tasks total</span>
                  </div>
                </>
              )
            }
          />
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-gutter xl:grid-cols-12">
        {/* Projects */}
        <section aria-labelledby="projects-heading" className="flex min-w-0 flex-col gap-space-md xl:col-span-8 2xl:col-span-9">
          <div className="flex items-center justify-between px-space-xs">
            <div className="flex items-center gap-2">
              <h2 id="projects-heading" className="text-headline-md text-on-surface">
                Projects
              </h2>
              {projects.data && <Pill>{projects.data.length} total</Pill>}
            </div>
            <ButtonLink href={`/${workspace.slug}/projects`} variant="ghost" size="sm">
              View all
            </ButtonLink>
          </div>
          <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-xs">
            {projects.isLoading ? (
              <div className="divide-y divide-[#e2e8f0]">
                {Array.from({ length: 3 }, (_, i) => (
                  <ProjectRowSkeleton key={i} />
                ))}
              </div>
            ) : projects.isError ? (
              <ErrorState error={projects.error} onRetry={() => projects.refetch()} title="Could not load projects" />
            ) : projects.data!.length === 0 ? (
              <EmptyState
                icon="create_new_folder"
                title="No projects yet"
                description={
                  workspace.can('admin')
                    ? 'Create your first project to start tracking tasks on a Kanban board.'
                    : 'An admin of this workspace has not created any projects yet.'
                }
                action={
                  workspace.can('admin') && (
                    <Button variant="primary" icon="add" onClick={() => setCreateOpen(true)}>
                      New project
                    </Button>
                  )
                }
              />
            ) : (
              <div className="divide-y divide-[#e2e8f0]">
                {projects.data!.map((p) => (
                  <ProjectRow key={p.id} project={p} href={`/${workspace.slug}/projects/${p.id}`} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Rail */}
        <aside className="flex flex-col gap-gutter xl:col-span-4 2xl:col-span-3">
          <Card>
            <CardHeader icon="flag" title="Upcoming Milestones" aside={<Pill className="rounded">{upcoming.length} open</Pill>} />
            <div className="flex flex-col gap-space-md">
              {milestonesLoading ? (
                Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-[92px] w-full" />)
              ) : upcoming.length === 0 ? (
                <EmptyState compact icon="flag" title="No upcoming milestones" description="Milestones you add to active projects show up here." />
              ) : (
                upcoming.map(({ m, project }) => <MilestoneItem key={m.id} milestone={m} subtitle={project.name} />)
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              icon="bolt"
              iconTone="info"
              title="Live Activity"
              aside={<span aria-hidden className="h-2 w-2 animate-ping rounded-full bg-tertiary-container" />}
            />
            <ActivityFeed
              items={activity.data?.items}
              loading={activity.isLoading}
              error={activity.isError ? activity.error : undefined}
              onRetry={() => activity.refetch()}
            />
          </Card>

          <Card>
            <CardHeader
              icon="groups"
              title="Squad Workload"
              aside={workload.data && <span className="font-mono text-[11px] text-outline">{workload.data.members.filter((m) => m.openTasks > 0).length} Assigned</span>}
            />
            {workload.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : workload.isError ? (
              <ErrorState compact error={workload.error} onRetry={() => workload.refetch()} />
            ) : (
              <div className="flex flex-col gap-space-md">
                {(workload.data?.members ?? []).slice(0, 4).map((m) => (
                  <WorkloadRow key={m.user.id} member={m} capacity={workload.data?.capacityHours} />
                ))}
              </div>
            )}
            <ButtonLink href={`/${workspace.slug}/workload`} variant="tonal" className="mt-space-md w-full">
              Manage Team Allocation
            </ButtonLink>
          </Card>
        </aside>
      </div>

      <CreateProjectDialog workspace={workspace} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
