'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Pill, TASK_STATUS } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ProgressBar, type ProgressTone } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useProjects, useWorkload } from '@/hooks/queries';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/cn';
import type { WorkloadMember } from '@/lib/types';

const TONE: Record<WorkloadMember['label'], { bar: ProgressTone; pill: 'success' | 'primary' | 'danger' | 'neutral' }> = {
  Available: { bar: 'primary', pill: 'neutral' },
  Balanced: { bar: 'primary', pill: 'primary' },
  Healthy: { bar: 'success', pill: 'success' },
  'High Load': { bar: 'danger', pill: 'danger' },
};

const BREAKDOWN = ['backlog', 'in_progress', 'in_review'] as const;

export default function WorkloadPage() {
  const workspace = useWorkspace();
  const projects = useProjects(workspace.id);
  const [projectId, setProjectId] = useState<string>('');
  const workload = useWorkload(workspace.id, projectId || undefined);
  const d = workload.data;
  const overloaded = d?.members.filter((m) => m.label === 'High Load').length ?? 0;

  return (
    <div className="flex flex-col">
      <PageHeader
        icon="group"
        title="Team Workload"
        badge={overloaded > 0 ? <Pill tone="danger">{overloaded} overloaded</Pill> : d && <Pill tone="success">Healthy team</Pill>}
        meta={
          d && (
            <span>
              Load = open estimated hours ÷ {d.capacityHours}h weekly capacity (tasks without an estimate count as {d.defaultTaskHours}h).
            </span>
          )
        }
        actions={
          <select
            aria-label="Project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="h-9 rounded-lg bg-surface-container-lowest px-2 text-body-sm text-on-surface shadow-xs focus:outline-none focus:ring-2 focus:ring-primary-container/20"
          >
            <option value="">All projects</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.keyPrefix} · {p.name}</option>
            ))}
          </select>
        }
      />

      {workload.isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : workload.isError ? (
        <Card><ErrorState error={workload.error} onRetry={() => workload.refetch()} /></Card>
      ) : !d || d.members.length === 0 ? (
        <Card className="p-0"><EmptyState icon="group" title="No members to show" /></Card>
      ) : (
        <div className="grid items-start gap-gutter 2xl:grid-cols-12">
          <Card className="p-0 2xl:col-span-8">
            <div role="table" aria-label="Workload by member">
              <div role="row" className="hidden items-center gap-space-md border-b border-[#e2e8f0] px-space-lg py-2 text-label-sm tracking-wider text-on-surface-variant uppercase md:flex">
                <span role="columnheader" className="flex-1">Member</span>
                <span role="columnheader" className="w-40">Open work</span>
                <span role="columnheader" className="w-52">Load</span>
                <span role="columnheader" className="w-24 text-right">Done this wk</span>
              </div>
              {d.members.map((m) => {
                const tone = TONE[m.label];
                const open = Math.max(1, m.openTasks);
                return (
                  <div key={m.user.id} role="row" className="flex flex-col gap-space-sm border-b border-[#e2e8f0] px-space-lg py-space-md last:border-0 md:flex-row md:items-center md:gap-space-md">
                    <div role="cell" className="flex min-w-[180px] flex-1 items-center gap-2.5">
                      <Avatar name={m.user.fullName} seed={m.user.id} src={m.user.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-label-md text-on-surface">{m.user.fullName}</p>
                        <p className="truncate text-[12px] text-on-surface-variant capitalize">
                          {m.role}
                          {m.overdue > 0 && <span className="normal-case text-error"> · {m.overdue} overdue</span>}
                        </p>
                      </div>
                    </div>
                    <div role="cell" className="w-full md:w-40">
                      <p className="tabular mb-1 text-label-sm text-on-surface">{m.openTasks} open task{m.openTasks === 1 ? '' : 's'}</p>
                      <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container" title={BREAKDOWN.map((s) => `${TASK_STATUS[s].label}: ${m.byStatus[s]}`).join(' · ')}>
                        {BREAKDOWN.map((s) => (
                          <div key={s} className={cn('h-full', TASK_STATUS[s].dot)} style={{ width: `${(m.byStatus[s] / open) * 100}%` }} />
                        ))}
                      </div>
                    </div>
                    <div role="cell" className="w-full md:w-52">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="tabular text-label-sm text-on-surface">{m.weightedHours}h · {m.loadPercent}%</span>
                        <Pill tone={tone.pill} className="text-[11px] font-bold">{m.label}</Pill>
                      </div>
                      <ProgressBar value={Math.min(100, m.loadPercent)} tone={tone.bar} label={`${m.user.fullName} load`} />
                    </div>
                    <div role="cell" className="tabular w-24 text-label-md text-on-surface md:text-right">
                      <span className="md:hidden text-on-surface-variant">Done this week: </span>
                      {m.completedThisWeek}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 2xl:col-span-4 2xl:grid-cols-1">
            <Card>
              <CardHeader icon="person_off" title="Unassigned work" />
              <p className="tabular text-headline-xl text-on-surface">{d.unassigned.openTasks}</p>
              <p className="text-body-sm text-on-surface-variant">open tasks · ≈{d.unassigned.weightedHours}h of work without an owner</p>
              <Link href={`/${workspace.slug}/tasks`} className="mt-space-md flex items-center gap-1 text-label-md text-primary hover:underline">
                Review in Tasks <Icon name="chevron_right" size={16} />
              </Link>
            </Card>
            <Card>
              <CardHeader icon="legend_toggle" title="Legend" />
              <ul className="flex flex-col gap-2 text-body-sm text-on-surface-variant">
                <li className="flex items-center gap-2"><Pill tone="primary">Balanced</Pill> up to 70% of capacity</li>
                <li className="flex items-center gap-2"><Pill tone="success">Healthy</Pill> 70–90%</li>
                <li className="flex items-center gap-2"><Pill tone="danger">High Load</Pill> above 90% — consider reassigning</li>
                <li className="flex items-center gap-2">
                  {BREAKDOWN.map((s) => (
                    <span key={s} className="flex items-center gap-1"><span className={cn('h-2 w-2 rounded-full', TASK_STATUS[s].dot)} />{TASK_STATUS[s].label}</span>
                  ))}
                </li>
              </ul>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
