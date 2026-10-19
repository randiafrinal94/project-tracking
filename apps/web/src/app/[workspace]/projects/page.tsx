'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { ProjectRow, ProjectRowSkeleton } from '@/components/projects/project-row';
import { Pill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useProjects } from '@/hooks/queries';
import { useWorkspace } from '@/hooks/use-workspace';
import type { ProjectStatus } from '@/lib/types';

type StatusFilter = 'all' | ProjectStatus;

function ProjectsList() {
  const workspace = useWorkspace();
  const projects = useProjects(workspace.id);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [status, setStatus] = useState<StatusFilter>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const q = params.get('q') ?? '';

  const setQuery = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`);
  };

  const all = projects.data ?? [];
  const countBy = (s: ProjectStatus) => all.filter((p) => p.status === s).length;
  const needle = q.trim().toLowerCase();
  const visible = all.filter(
    (p) =>
      (status === 'all' || p.status === status) &&
      (!needle || p.name.toLowerCase().includes(needle) || p.keyPrefix.toLowerCase().includes(needle)),
  );

  return (
    <div className="flex flex-col">
      <PageHeader
        icon="folder_open"
        title="Projects"
        badge={projects.data && <Pill tone="strong">{all.length}</Pill>}
        meta={<span>Every project in {workspace.name}, with live task completion.</span>}
        actions={
          workspace.can('admin') && (
            <Button variant="primary" icon="add" onClick={() => setCreateOpen(true)}>
              New project
            </Button>
          )
        }
      >
        <div className="flex flex-col items-stretch justify-between gap-space-md pt-space-xs lg:flex-row lg:items-center">
          <div className="overflow-x-auto no-scrollbar">
            <SegmentedTabs
              label="Filter by status"
              active={status}
              onChange={(id) => setStatus(id as StatusFilter)}
              tabs={[
                { id: 'all', label: 'All', count: all.length },
                { id: 'active', label: 'Active', icon: 'play_circle', count: countBy('active') },
                { id: 'planning', label: 'Planning', icon: 'edit_calendar', count: countBy('planning') },
                { id: 'on_hold', label: 'On hold', icon: 'pause_circle', count: countBy('on_hold') },
                { id: 'completed', label: 'Completed', icon: 'check_circle', count: countBy('completed') },
              ]}
            />
          </div>
          <Input
            icon="search"
            inputSize="sm"
            type="search"
            aria-label="Filter projects"
            placeholder="Filter projects..."
            defaultValue={q}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full lg:w-56"
          />
        </div>
      </PageHeader>

      <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-xs">
        {projects.isLoading ? (
          <div className="divide-y divide-[#e2e8f0]">
            {Array.from({ length: 4 }, (_, i) => (
              <ProjectRowSkeleton key={i} />
            ))}
          </div>
        ) : projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => projects.refetch()} title="Could not load projects" />
        ) : visible.length === 0 ? (
          all.length === 0 ? (
            <EmptyState
              icon="create_new_folder"
              title="No projects yet"
              description="Projects group tasks, milestones and the Kanban board for a team deliverable."
              action={
                workspace.can('admin') && (
                  <Button variant="primary" icon="add" onClick={() => setCreateOpen(true)}>
                    New project
                  </Button>
                )
              }
            />
          ) : (
            <EmptyState
              icon="search_off"
              title="No matching projects"
              description="Try a different status or search term."
              action={
                <Button
                  variant="tonal"
                  size="sm"
                  onClick={() => {
                    setStatus('all');
                    setQuery('');
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          )
        ) : (
          <div className="divide-y divide-[#e2e8f0]">
            {visible.map((p) => (
              <ProjectRow key={p.id} project={p} href={`/${workspace.slug}/projects/${p.id}`} />
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog workspace={workspace} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense>
      <ProjectsList />
    </Suspense>
  );
}
