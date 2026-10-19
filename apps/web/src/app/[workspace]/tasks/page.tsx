'use client';

import { Suspense, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { TaskModalHost, useTaskParam } from '@/components/task/task-modal-host';
import { TaskTable } from '@/components/tasks/task-table';
import { WorkspaceTaskFilters } from '@/components/tasks/workspace-task-filters';
import { Pill } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { useProjects } from '@/hooks/queries';
import { useTaskList } from '@/hooks/task-list';
import { useWorkspace } from '@/hooks/use-workspace';
import type { TaskFilters, TaskSort } from '@/lib/types';

function TasksList() {
  const workspace = useWorkspace();
  const projects = useProjects(workspace.id);
  const { open } = useTaskParam();
  const [filters, setFilters] = useState<TaskFilters>({ assigneeId: 'me' });
  const [sort, setSort] = useState<TaskSort>('due');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const list = useTaskList({ kind: 'workspace', id: workspace.id }, filters, sort, dir);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const total = list.data?.pages[0]?.total ?? 0;

  return (
    <div className="flex flex-col">
      <PageHeader
        icon="check_box"
        title="Tasks"
        badge={list.data && <Pill tone="strong">{total}</Pill>}
        meta={<span>Every task across {workspace.name}&apos;s active projects.</span>}
        actions={
          <ButtonLink href={`/${workspace.slug}/tasks/kanban`} icon="view_kanban">
            Kanban
          </ButtonLink>
        }
      >
        <WorkspaceTaskFilters filters={filters} onChange={setFilters} projects={projects.data ?? []} />
      </PageHeader>

      <TaskTable
        tasks={items}
        total={total}
        showProject
        sort={sort}
        dir={dir}
        onSort={(next) => {
          if (next === sort) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
          else {
            setSort(next);
            setDir(next === 'updated' || next === 'priority' ? 'desc' : 'asc');
          }
        }}
        onOpen={(t) => open(t)}
        loading={list.isLoading}
        error={list.isError ? list.error : undefined}
        onRetry={() => list.refetch()}
        hasMore={!!list.hasNextPage}
        loadingMore={list.isFetchingNextPage}
        onLoadMore={() => void list.fetchNextPage()}
        emptyTitle={filters.assigneeId === 'me' ? 'Nothing assigned to you' : 'No tasks found'}
        emptyDescription={filters.assigneeId === 'me' ? 'Switch to “All tasks” to see the rest of the team’s work.' : 'Try clearing some filters.'}
      />
      <TaskModalHost />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense>
      <TasksList />
    </Suspense>
  );
}
