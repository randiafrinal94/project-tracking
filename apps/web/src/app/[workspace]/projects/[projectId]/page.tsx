'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useState } from 'react';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { BoardFilters } from '@/components/board/board-filters';
import { KanbanBoard } from '@/components/board/kanban-board';
import { MetaDot, PageHeader } from '@/components/layout/page-header';
import { MilestoneItem } from '@/components/milestones/milestone-item';
import { GanttTimeline } from '@/components/project/gantt';
import { ProjectOverview } from '@/components/project/project-overview';
import { TaskModal } from '@/components/task/task-modal';
import { TaskTable } from '@/components/tasks/task-table';
import { Pill, ProjectStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownTrigger } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { KpiCard } from '@/components/ui/kpi-card';
import { ProgressBar } from '@/components/ui/progress';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useMembers, useMilestones, useProjectActivity, useTags } from '@/hooks/queries';
import { useTaskList } from '@/hooks/task-list';
import { useWorkspace } from '@/hooks/use-workspace';
import { api } from '@/lib/api';
import { exportProjectTasksCsv } from '@/lib/export';
import { daysFromToday, longDate, shortDate } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import type { Milestone, Project, TaskFilters, TaskSort } from '@/lib/types';
import { useMe } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

type View = 'overview' | 'kanban' | 'gantt' | 'list';
const VIEWS: View[] = ['overview', 'kanban', 'gantt', 'list'];

function ProjectKpis({ project, milestones, loading, onShowOverdue }: { project: Project; milestones: Milestone[]; loading: boolean; onShowOverdue: () => void }) {
  const s = project.stats;
  const open = milestones.filter((m) => !m.isCompleted);
  const next = [...open].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))[0];
  const nextDays = next?.dueDate ? daysFromToday(next.dueDate) : null;

  return (
    <section aria-label="Project metrics" className="mb-space-xl grid grid-cols-1 gap-gutter sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total Tasks"
        icon="folder_copy"
        value={s.totalTasks}
        aside={<span className="text-label-sm text-on-surface-variant">active</span>}
        description={
          <p className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary-container" />
            {open.length} open milestone{open.length === 1 ? '' : 's'}
          </p>
        }
      />
      <KpiCard
        label="Tasks Completed"
        icon="task_alt"
        iconTone="success"
        value={
          <>
            {s.completedTasks} <span className="text-headline-md text-on-surface-variant">/ {s.totalTasks}</span>
          </>
        }
        footer={
          <>
            <ProgressBar size="md" tone="success" value={s.completionRate} label="Tasks completed" />
            <div className="mt-1 flex justify-between text-[10px] font-semibold tracking-[0.04em] text-outline">
              <span>{s.totalTasks - s.completedTasks} remaining</span>
              <span className="text-tertiary-container">{s.completionRate}%</span>
            </div>
          </>
        }
      />
      <KpiCard
        label="Overdue Items"
        icon="warning"
        iconTone="danger"
        value={s.overdueTasks}
        valueClassName={s.overdueTasks ? 'text-error' : undefined}
        aside={s.overdueTasks ? <Pill tone="danger" className="font-semibold">Immediate Action</Pill> : <Pill tone="success" className="font-semibold">On track</Pill>}
        description={
          s.overdueTasks ? (
            <button type="button" className="text-left text-primary hover:underline" onClick={onShowOverdue}>
              Show overdue tasks on the board
            </button>
          ) : (
            'No tasks past their due date'
          )
        }
      />
      <KpiCard
        label="Milestone Progress"
        icon="timer"
        iconTone="primary"
        loading={loading}
        value={next ? `${next.progress.percent}%` : '—'}
        asideEnd
        aside={
          nextDays !== null && (
            <span className={`text-label-md font-semibold ${nextDays < 0 ? 'text-error' : 'text-primary'}`}>
              {nextDays < 0 ? `${-nextDays} days late` : `${nextDays} days left`}
            </span>
          )
        }
        description={next ? <p className="truncate">{next.name}</p> : 'No open milestones'}
        footer={
          next && (
            <>
              <ProgressBar size="md" value={next.progress.percent} label="Milestone progress" />
              <div className="mt-1 flex justify-between text-[10px] font-semibold tracking-[0.04em] text-outline">
                <span>{next.dueDate ? `Due ${longDate(next.dueDate)}` : 'No due date'}</span>
                <span className="tabular">{next.progress.total - next.progress.completed} items to verify</span>
              </div>
            </>
          )
        }
      />
    </section>
  );
}

function ProjectListView({ project, filters, onOpen }: { project: Project; filters: TaskFilters; onOpen: (id: string) => void }) {
  const [sort, setSort] = useState<TaskSort>('key');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const list = useTaskList({ kind: 'project', id: project.id }, filters, sort, dir);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <TaskTable
      tasks={items}
      total={list.data?.pages[0]?.total ?? 0}
      sort={sort}
      dir={dir}
      onSort={(next) => {
        if (next === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else {
          setSort(next);
          setDir(next === 'updated' || next === 'priority' ? 'desc' : 'asc');
        }
      }}
      onOpen={(t) => onOpen(t.id)}
      loading={list.isLoading}
      error={list.isError ? list.error : undefined}
      onRetry={() => list.refetch()}
      hasMore={!!list.hasNextPage}
      loadingMore={list.isFetchingNextPage}
      onLoadMore={() => void list.fetchNextPage()}
    />
  );
}

function ProjectPageInner() {
  const { projectId } = useParams<{ projectId: string }>();
  const workspace = useWorkspace();
  const { user } = useMe();
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const openTaskId = params.get('task');
  const viewParam = params.get('view') as View | null;
  const view: View = viewParam && VIEWS.includes(viewParam) ? viewParam : 'kanban';

  const project = useQuery({ queryKey: qk.project(projectId), queryFn: () => api<Project>(`/projects/${projectId}`) });
  const members = useMembers(workspace.id);
  const tags = useTags(workspace.id);
  const milestones = useMilestones(projectId);
  const activity = useProjectActivity(projectId);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [exporting, setExporting] = useState(false);
  const canEdit = workspace.can('member');

  const setParam = useCallback(
    (key: 'task' | 'view', value: string | null) => {
      const next = new URLSearchParams(params);
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    },
    [params, pathname, router],
  );
  const openTask = useCallback((id: string | null) => setParam('task', id), [setParam]);

  if (project.isError) {
    return (
      <Card>
        <ErrorState error={project.error} onRetry={() => project.refetch()} title="Could not open project" />
      </Card>
    );
  }

  const p = project.data;
  if (!p) {
    return (
      <div aria-busy className="flex flex-col gap-space-xl">
        <div className="flex items-center gap-space-md">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-7 w-80" />
            <Skeleton className="h-4 w-56" />
          </div>
        </div>
        <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const openMilestones = (milestones.data ?? []).filter((m) => !m.isCompleted);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const count = await exportProjectTasksCsv(p.id, p.keyPrefix.toLowerCase());
      toast({ tone: 'success', title: 'Export ready', description: `${count} tasks exported to CSV.` });
    } catch (e) {
      toast({ tone: 'error', title: 'Export failed', description: (e as Error).message });
    } finally {
      setExporting(false);
    }
  };

  const rail = (
    <>
      <Card>
        <CardHeader icon="flag" title="Upcoming Milestones" aside={<Pill className="rounded">{p.keyPrefix}</Pill>} />
        <div className="flex flex-col gap-space-md">
          {milestones.isLoading ? (
            Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-[92px] w-full" />)
          ) : milestones.isError ? (
            <ErrorState compact error={milestones.error} onRetry={() => milestones.refetch()} />
          ) : openMilestones.length === 0 ? (
            <EmptyState compact icon="flag" title="No open milestones" description="Group deliverables into milestones to track phase progress." />
          ) : (
            openMilestones.slice(0, 3).map((m) => <MilestoneItem key={m.id} milestone={m} />)
          )}
        </div>
      </Card>
      <Card>
        <CardHeader icon="bolt" iconTone="info" title="Live Activity" aside={<span aria-hidden className="h-2 w-2 animate-ping rounded-full bg-tertiary-container" />} />
        <ActivityFeed items={activity.data?.items} loading={activity.isLoading} error={activity.isError ? activity.error : undefined} onRetry={() => activity.refetch()} />
      </Card>
    </>
  );

  return (
    <div className="flex w-full flex-col">
      <PageHeader
        icon="terminal"
        title={p.name}
        badge={
          <ProjectStatusBadge status={p.status}>
            {p.status === 'active' && p.startDate && p.targetDate ? `Active (${shortDate(p.startDate)} – ${shortDate(p.targetDate)})` : undefined}
          </ProjectStatusBadge>
        }
        meta={
          <>
            {p.targetDate && (
              <span>
                Target: <strong className="text-label-md text-on-surface">{longDate(p.targetDate)}</strong>
              </span>
            )}
            {p.targetDate && <MetaDot />}
            <span>{members.data ? `${members.data.length} members` : '—'}</span>
            <MetaDot />
            <span className="rounded bg-surface-container-high px-1.5 py-0.5 font-mono text-code-inline text-on-surface">
              {p.keyPrefix}-{p.taskCounter}
            </span>
          </>
        }
        actions={
          <>
            <Button
              icon="share"
              onClick={async () => {
                await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
                toast({ tone: 'success', title: 'Link copied' });
              }}
            >
              Share
            </Button>
            <Dropdown>
              <DropdownTrigger asChild>
                <Button icon="view_column" trailingIcon="arrow_drop_down" className="[&>span:first-child]:text-primary">
                  Group: Status
                </Button>
              </DropdownTrigger>
              <DropdownContent align="end">
                <DropdownLabel>Group board by</DropdownLabel>
                <DropdownItem icon="check" active>Status</DropdownItem>
              </DropdownContent>
            </Dropdown>
            <Button variant="tonal" icon="file_download" loading={exporting} onClick={exportCsv}>
              Export
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-stretch justify-between gap-space-md pt-space-xs lg:flex-row lg:items-center">
          <div className="overflow-x-auto no-scrollbar">
            <SegmentedTabs
              label="Project views"
              active={view}
              onChange={(id) => setParam('view', id === 'kanban' ? null : id)}
              tabs={[
                { id: 'overview', label: 'Overview' },
                { id: 'kanban', label: 'Kanban Board', icon: 'view_kanban', count: p.stats.totalTasks },
                { id: 'gantt', label: 'Gantt Timeline', icon: 'waterfall_chart' },
                { id: 'list', label: 'List View', icon: 'list_alt' },
              ]}
            />
          </div>
          {view !== 'overview' && (
            <BoardFilters
              filters={filters}
              onChange={setFilters}
              members={members.data ?? []}
              tags={tags.data ?? []}
              milestones={milestones.data ?? []}
              currentUserId={user.id}
            />
          )}
        </div>
      </PageHeader>

      {view === 'overview' && (
        <ProjectOverview project={p} milestones={milestones.data ?? []} milestonesLoading={milestones.isLoading} isAdmin={workspace.can('admin')} />
      )}

      {view === 'kanban' && (
        <>
          <ProjectKpis project={p} milestones={milestones.data ?? []} loading={milestones.isLoading} onShowOverdue={() => setFilters({ ...filters, overdue: true })} />
          {/*
            Container query: rail hanya di samping board bila lebar konten ≥ 1344px
            (4 kolom × 228px + celah + rail 360px). Di bawah itu rail turun ke bawah board
            sehingga keempat kolom — termasuk Done — selalu terlihat tanpa scroll horizontal.
          */}
          <div className="@container">
            <div className="grid grid-cols-1 items-start gap-gutter @min-[84rem]:grid-cols-[minmax(0,1fr)_360px]">
              <section aria-labelledby="board-heading" className="flex min-w-0 flex-col gap-space-md">
                <div className="flex items-center justify-between px-space-xs">
                  <div className="flex items-center gap-2">
                    <h2 id="board-heading" className="text-headline-md text-on-surface">Workflow Matrix</h2>
                    <Pill>4 stages</Pill>
                  </div>
                  <span className="hidden items-center gap-space-sm text-body-sm text-on-surface-variant sm:flex">
                    {canEdit ? 'Drag cards to update state' : (<><Icon name="visibility" size={16} /> View only</>)}
                  </span>
                </div>
                <KanbanBoard project={p} filters={filters} canEdit={canEdit} onOpenTask={openTask} />
              </section>
              <aside className="grid grid-cols-1 gap-gutter md:grid-cols-2 @min-[84rem]:grid-cols-1">{rail}</aside>
            </div>
          </div>
        </>
      )}

      {view === 'list' && <ProjectListView project={p} filters={filters} onOpen={openTask} />}

      {view === 'gantt' && (
        <GanttTimeline project={p} milestones={milestones.data ?? []} filters={filters} canEdit={canEdit} onOpenTask={openTask} />
      )}

      <TaskModal
        taskId={openTaskId}
        project={p}
        canEdit={canEdit}
        isAdmin={workspace.can('admin')}
        currentUser={{ id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl }}
        onClose={() => openTask(null)}
      />
    </div>
  );
}

export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectPageInner />
    </Suspense>
  );
}
