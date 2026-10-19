'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { MilestoneManager } from '@/components/milestones/milestone-manager';
import { Pill, ProjectStatusBadge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useProjects, useWorkspaceMilestones } from '@/hooks/queries';
import { useWorkspace } from '@/hooks/use-workspace';
import { daysFromToday } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import type { WorkspaceMilestone } from '@/lib/types';

type Filter = 'open' | 'overdue' | 'completed' | 'all';

const matches = (m: WorkspaceMilestone, f: Filter) =>
  f === 'all' ||
  (f === 'completed' && m.isCompleted) ||
  (f === 'open' && !m.isCompleted) ||
  (f === 'overdue' && !m.isCompleted && !!m.dueDate && daysFromToday(m.dueDate) < 0);

export default function MilestonesPage() {
  const workspace = useWorkspace();
  const milestones = useWorkspaceMilestones(workspace.id);
  const projects = useProjects(workspace.id);
  const [filter, setFilter] = useState<Filter>('open');
  const all = milestones.data ?? [];
  const visible = all.filter((m) => matches(m, filter));
  const canManage = workspace.can('admin');

  // Kelompokkan per project; project tanpa milestone tetap tampil agar admin bisa menambah.
  const groups = (projects.data ?? [])
    .map((p) => ({ project: p, items: visible.filter((m) => m.projectId === p.id) }))
    .filter((g) => g.items.length > 0 || (canManage && filter !== 'completed' && filter !== 'overdue'));

  return (
    <div className="flex flex-col">
      <PageHeader
        icon="flag"
        title="Milestones"
        badge={milestones.data && <Pill tone="strong">{all.filter((m) => !m.isCompleted).length} open</Pill>}
        meta={<span>Roadmap of phases and sprints across every active project.</span>}
      >
        <div className="overflow-x-auto no-scrollbar pt-space-xs">
          <SegmentedTabs
            label="Filter milestones"
            active={filter}
            onChange={(id) => setFilter(id as Filter)}
            tabs={[
              { id: 'open', label: 'Open', icon: 'flag', count: all.filter((m) => matches(m, 'open')).length },
              { id: 'overdue', label: 'Overdue', icon: 'alarm', count: all.filter((m) => matches(m, 'overdue')).length },
              { id: 'completed', label: 'Completed', icon: 'check_circle', count: all.filter((m) => m.isCompleted).length },
              { id: 'all', label: 'All', count: all.length },
            ]}
          />
        </div>
      </PageHeader>

      {milestones.isLoading || projects.isLoading ? (
        <div className="grid gap-gutter lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : milestones.isError ? (
        <Card><ErrorState error={milestones.error} onRetry={() => milestones.refetch()} /></Card>
      ) : groups.length === 0 ? (
        <Card className="p-0">
          <EmptyState icon="flag" title="No milestones here" description="Try another filter, or add milestones from a project's Overview tab." />
        </Card>
      ) : (
        <div className="grid items-start gap-gutter lg:grid-cols-2">
          {groups.map(({ project, items }) => (
            <Card key={project.id}>
              <div className="mb-space-md flex items-center justify-between gap-space-sm">
                <Link href={`/${workspace.slug}/projects/${project.id}?view=overview`} className="group flex min-w-0 items-center gap-2">
                  <span className="font-mono text-code-inline text-outline">{project.keyPrefix}</span>
                  <h2 className="truncate text-headline-sm text-on-surface group-hover:text-primary">{project.name}</h2>
                  <Icon name="arrow_outward" size={16} className="text-outline opacity-0 group-hover:opacity-100" />
                </Link>
                <ProjectStatusBadge status={project.status} />
              </div>
              <MilestoneManager
                milestones={items}
                projectId={project.id}
                canManage={canManage}
                invalidateKeys={[qk.workspaceMilestones(workspace.id), qk.milestones(project.id)]}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
