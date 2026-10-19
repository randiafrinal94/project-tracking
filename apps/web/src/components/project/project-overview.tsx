'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { MilestoneManager } from '@/components/milestones/milestone-manager';
import { ProjectStatusBadge, TASK_STATUS } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { Input, Textarea } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/states';
import { WorkloadRow } from '@/components/workload/workload-list';
import { STATUSES } from '@/hooks/board';
import { useProjectActivity, useWorkload } from '@/hooks/queries';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { longDate } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import type { Milestone, Page, Project, ProjectStatus, TaskCard } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';

const PROJECT_STATUSES: ProjectStatus[] = ['planning', 'active', 'on_hold', 'completed'];

/** Tab "Overview" project: ringkasan, detail (admin dapat mengedit), milestone, squad, aktivitas. */
export function ProjectOverview({
  project,
  milestones,
  milestonesLoading,
  isAdmin,
}: {
  project: Project;
  milestones: Milestone[];
  milestonesLoading: boolean;
  isAdmin: boolean;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const workload = useWorkload(project.workspaceId, project.id);
  const activity = useProjectActivity(project.id, 10);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(project.description ?? '');
  const [startDate, setStartDate] = useState(project.startDate ?? '');
  const [targetDate, setTargetDate] = useState(project.targetDate ?? '');

  useEffect(() => {
    if (!editing) {
      setDescription(project.description ?? '');
      setStartDate(project.startDate ?? '');
      setTargetDate(project.targetDate ?? '');
    }
  }, [project, editing]);

  // Distribusi status (satu request ringan per status, hanya total).
  const statusCounts = useQuery({
    queryKey: [...qk.tasks(project.id), 'status-counts'],
    queryFn: async () => {
      const counts = await Promise.all(
        STATUSES.map((status) => api<Page<TaskCard>>(`/projects/${project.id}/tasks`, { query: { status, limit: 1 } })),
      );
      return Object.fromEntries(STATUSES.map((s, i) => [s, counts[i]!.total ?? 0])) as Record<(typeof STATUSES)[number], number>;
    },
  });

  const save = useMutation({
    mutationFn: (body: Partial<Pick<Project, 'description' | 'startDate' | 'targetDate' | 'status'>>) =>
      api<Project>(`/projects/${project.id}`, { method: 'PATCH', body }),
    onSuccess: (p) => {
      queryClient.setQueryData(qk.project(project.id), p);
      queryClient.invalidateQueries({ queryKey: qk.projects(project.workspaceId) });
      setEditing(false);
      toast({ tone: 'success', title: 'Project updated' });
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not update project', description: (e as Error).message }),
  });

  const counts = statusCounts.data;
  const total = counts ? STATUSES.reduce((s, k) => s + counts[k], 0) : 0;
  const squad = (workload.data?.members ?? []).filter((m) => m.openTasks > 0 || m.completedThisWeek > 0);

  return (
    <div className="grid grid-cols-1 items-start gap-gutter xl:grid-cols-12">
      <div className="flex min-w-0 flex-col gap-gutter xl:col-span-8">
        <Card>
          <CardHeader
            icon="info"
            title="About this project"
            aside={
              isAdmin &&
              !editing && (
                <Button size="sm" variant="ghost" icon="edit" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )
            }
          />
          {editing ? (
            <form
              className="flex flex-col gap-space-md"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate({ description: description.trim() || null, startDate: startDate || null, targetDate: targetDate || null });
              }}
            >
              <Textarea rows={4} aria-label="Project description" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project about? Goals, scope, links…" />
              <div className="grid gap-space-md sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-label-md font-semibold text-on-surface">
                  Start date
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-label-md font-semibold text-on-surface">
                  Target date
                  <Input type="date" value={targetDate} min={startDate || undefined} onChange={(e) => setTargetDate(e.target.value)} />
                </label>
              </div>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                <Button variant="primary" type="submit" loading={save.isPending}>Save</Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-space-md">
              <p className={cn('whitespace-pre-line text-body-md', project.description ? 'text-on-surface' : 'text-outline')}>
                {project.description ?? 'No description yet.'}
              </p>
              <dl className="grid grid-cols-2 gap-space-md rounded-lg bg-surface-container-low p-space-md sm:grid-cols-4">
                <div>
                  <dt className="text-label-sm tracking-wider text-on-surface-variant uppercase">Status</dt>
                  <dd className="mt-1">
                    {isAdmin ? (
                      <Dropdown>
                        <DropdownTrigger asChild>
                          <button type="button" aria-label="Change project status" className="flex items-center gap-1">
                            <ProjectStatusBadge status={project.status} />
                            <Icon name="expand_more" size={16} className="text-outline" />
                          </button>
                        </DropdownTrigger>
                        <DropdownContent>
                          {PROJECT_STATUSES.map((s) => (
                            <DropdownItem key={s} active={s === project.status} onSelect={() => s !== project.status && save.mutate({ status: s })}>
                              <ProjectStatusBadge status={s} />
                            </DropdownItem>
                          ))}
                        </DropdownContent>
                      </Dropdown>
                    ) : (
                      <ProjectStatusBadge status={project.status} />
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-label-sm tracking-wider text-on-surface-variant uppercase">Key</dt>
                  <dd className="mt-1 font-mono text-code-inline text-on-surface">{project.keyPrefix}</dd>
                </div>
                <div>
                  <dt className="text-label-sm tracking-wider text-on-surface-variant uppercase">Start</dt>
                  <dd className="mt-1 text-label-md text-on-surface">{project.startDate ? longDate(project.startDate) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-label-sm tracking-wider text-on-surface-variant uppercase">Target</dt>
                  <dd className="mt-1 text-label-md text-on-surface">{project.targetDate ? longDate(project.targetDate) : '—'}</dd>
                </div>
              </dl>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader icon="donut_large" title="Work by status" aside={<span className="tabular text-label-sm text-on-surface-variant">{total} tasks</span>} />
          {!counts ? (
            <Skeleton className="h-16 w-full" />
          ) : total === 0 ? (
            <EmptyState compact icon="inbox" title="No tasks yet" description="Create tasks from the Kanban board." />
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-container" role="img" aria-label={STATUSES.map((s) => `${TASK_STATUS[s].label} ${counts[s]}`).join(', ')}>
                {STATUSES.map((s) => (
                  <div key={s} className={cn('h-full', TASK_STATUS[s].dot)} style={{ width: `${(counts[s] / total) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-space-md grid grid-cols-2 gap-space-md sm:grid-cols-4">
                {STATUSES.map((s) => (
                  <li key={s} className="flex flex-col">
                    <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                      <span className={cn('h-2 w-2 rounded-full', TASK_STATUS[s].dot)} /> {TASK_STATUS[s].label}
                    </span>
                    <span className="tabular text-headline-md text-on-surface">{counts[s]}</span>
                    <span className="tabular text-[11px] text-outline">{Math.round((counts[s] / total) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card>
          <CardHeader icon="flag" title="Milestones" aside={<span className="tabular text-label-sm text-on-surface-variant">{milestones.length}</span>} />
          {milestonesLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <MilestoneManager
              milestones={milestones}
              projectId={project.id}
              canManage={isAdmin}
              invalidateKeys={[qk.milestones(project.id), qk.workspaceMilestones(project.workspaceId), qk.project(project.id)]}
            />
          )}
        </Card>
      </div>

      <aside className="flex flex-col gap-gutter xl:col-span-4">
        <Card>
          <CardHeader icon="groups" title="Squad on this project" aside={<span className="font-mono text-[11px] text-outline">{squad.length} active</span>} />
          {workload.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : squad.length === 0 ? (
            <EmptyState compact icon="group" title="No one assigned yet" />
          ) : (
            <div className="flex flex-col gap-space-md">
              {squad.map((m) => (
                <WorkloadRow key={m.user.id} member={m} capacity={workload.data?.capacityHours} />
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader icon="bolt" iconTone="info" title="Recent Activity" />
          <ActivityFeed items={activity.data?.items} loading={activity.isLoading} error={activity.isError ? activity.error : undefined} onRetry={() => activity.refetch()} />
        </Card>
      </aside>
    </div>
  );
}
