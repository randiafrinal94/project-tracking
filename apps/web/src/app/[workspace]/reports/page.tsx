'use client';

import { useState } from 'react';
import { ChartCard, DataTable, Legend, SERIES } from '@/components/charts/chart-kit';
import { GroupedColumns } from '@/components/charts/grouped-columns';
import { LineChart } from '@/components/charts/line-chart';
import { PageHeader } from '@/components/layout/page-header';
import { priorityLabel, TASK_STATUS } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ProgressBar } from '@/components/ui/progress';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { STATUSES } from '@/hooks/board';
import { useProjects, useReports } from '@/hooks/queries';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/cn';
import type { TaskPriority } from '@/lib/types';

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

const weekLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-surface-container-lowest p-space-lg shadow-xs">
      <p className="text-label-md tracking-wider text-on-surface-variant uppercase">{label}</p>
      <p className="mt-space-sm text-headline-xl text-on-surface">{value}</p>
      {hint && <p className="text-body-sm text-on-surface-variant">{hint}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const workspace = useWorkspace();
  const projects = useProjects(workspace.id);
  const [weeks, setWeeks] = useState(8);
  const [projectId, setProjectId] = useState('');
  const report = useReports(workspace.id, weeks, projectId || undefined);
  const d = report.data;

  const statusTotal = d ? STATUSES.reduce((s, k) => s + d.byStatus[k], 0) : 0;
  const prioMax = d ? Math.max(1, ...PRIORITIES.map((p) => d.openByPriority[p])) : 1;

  return (
    <div className="flex flex-col">
      <PageHeader icon="bar_chart" title="Reports" meta={<span>Throughput, cycle time and effort across {workspace.name}.</span>}>
        {/* Satu baris filter di atas semua chart — semua angka memakai irisan yang sama. */}
        <div className="flex flex-wrap items-center gap-space-sm pt-space-xs">
          <SegmentedTabs
            label="Time range"
            active={String(weeks)}
            onChange={(id) => setWeeks(Number(id))}
            tabs={[4, 8, 12, 26].map((w) => ({ id: String(w), label: `${w} weeks` }))}
          />
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
        </div>
      </PageHeader>

      {report.isError ? (
        <Card><ErrorState error={report.error} onRetry={() => report.refetch()} title="Could not load reports" /></Card>
      ) : !d ? (
        <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          <Skeleton className="h-72 rounded-xl sm:col-span-2 xl:col-span-4" />
        </div>
      ) : (
        // Refetch: pertahankan render sebelumnya dengan opacity berkurang (tanpa skeleton/lompatan layout).
        <div className={cn('flex flex-col gap-gutter transition-opacity', report.isFetching && 'opacity-60')}>
          <section aria-label="Summary" className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Tasks completed" value={String(d.summary.completed)} hint={`in the last ${d.weeks} weeks`} />
            <StatTile label="Avg per week" value={String(d.summary.avgPerWeek)} hint="completed tasks" />
            <StatTile label="Avg cycle time" value={d.summary.avgCycleDays === null ? '—' : `${d.summary.avgCycleDays}d`} hint="created → done" />
            <StatTile label="Tasks created" value={String(d.summary.created)} hint={`in the last ${d.weeks} weeks`} />
          </section>

          <ChartCard
            title="Weekly throughput"
            subtitle="Tasks created vs completed per week (weeks start Monday)"
            legend={<Legend items={[{ label: 'Completed', color: SERIES[0] }, { label: 'Created', color: SERIES[1] }]} />}
            table={
              <DataTable
                head={['Week of', 'Completed', 'Created', 'Avg cycle (days)']}
                rows={d.weekly.map((w) => [weekLabel(w.weekStart), w.completed, w.created, w.avgCycleDays ?? '—'])}
              />
            }
          >
            <GroupedColumns
              categories={d.weekly.map((w) => w.weekStart)}
              formatCategory={weekLabel}
              series={[
                { label: 'Completed', color: SERIES[0], values: d.weekly.map((w) => w.completed) },
                { label: 'Created', color: SERIES[1], values: d.weekly.map((w) => w.created) },
              ]}
            />
          </ChartCard>

          <div className="grid items-start gap-gutter xl:grid-cols-2">
            <ChartCard
              title="Cycle time"
              subtitle="Average days from creation to done, by completion week"
              table={<DataTable head={['Week of', 'Avg cycle (days)', 'Completed']} rows={d.weekly.map((w) => [weekLabel(w.weekStart), w.avgCycleDays ?? '—', w.completed])} />}
            >
              <LineChart
                categories={d.weekly.map((w) => w.weekStart)}
                values={d.weekly.map((w) => w.avgCycleDays)}
                color={SERIES[0]}
                label="Avg cycle time"
                unit="d"
                formatCategory={weekLabel}
              />
            </ChartCard>

            <ChartCard
              title="Work by status"
              subtitle={`${statusTotal} active tasks`}
              table={<DataTable head={['Status', 'Tasks', 'Share']} rows={STATUSES.map((s) => [TASK_STATUS[s].label, d.byStatus[s], `${statusTotal ? Math.round((d.byStatus[s] / statusTotal) * 100) : 0}%`])} />}
            >
              {/* Stacked bar: celah 2px antar segmen (warna status = warna kolom board). */}
              <div className="flex h-6 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label={STATUSES.map((s) => `${TASK_STATUS[s].label}: ${d.byStatus[s]}`).join(', ')}>
                {STATUSES.filter((s) => d.byStatus[s] > 0).map((s) => (
                  <div key={s} title={`${TASK_STATUS[s].label}: ${d.byStatus[s]}`} className={cn('h-full first:rounded-l last:rounded-r', TASK_STATUS[s].dot)} style={{ width: `${(d.byStatus[s] / Math.max(1, statusTotal)) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-space-md grid grid-cols-2 gap-space-md sm:grid-cols-4">
                {STATUSES.map((s) => (
                  <li key={s}>
                    <span className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
                      <span aria-hidden className={cn('h-2.5 w-2.5 rounded-sm', TASK_STATUS[s].dot)} />
                      {TASK_STATUS[s].label}
                    </span>
                    <span className="text-headline-md text-on-surface">{d.byStatus[s]}</span>
                  </li>
                ))}
              </ul>

              <h4 className="mb-space-sm mt-space-lg text-label-md font-semibold text-on-surface">Open work by priority</h4>
              <ul className="flex flex-col gap-2">
                {PRIORITIES.map((p) => (
                  <li key={p} className="grid grid-cols-[64px_minmax(0,1fr)_32px] items-center gap-space-sm">
                    <span className="text-[12px] text-on-surface-variant">{priorityLabel(p)}</span>
                    <div className="h-3 w-full">
                      <div className="h-3 rounded-r" style={{ width: `${(d.openByPriority[p] / prioMax) * 100}%`, background: SERIES[0], minWidth: d.openByPriority[p] ? 4 : 0 }} />
                    </div>
                    <span className="tabular text-right text-[12px] font-semibold text-on-surface">{d.openByPriority[p]}</span>
                  </li>
                ))}
              </ul>
            </ChartCard>
          </div>

          <Card className="p-0">
            <div className="px-space-lg pb-space-sm pt-space-lg">
              <h3 className="text-headline-sm text-on-surface">Projects: progress & effort</h3>
              <p className="text-body-sm text-on-surface-variant">Estimated vs logged hours; variance above 0 means more time than planned.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-body-sm">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-label-sm tracking-wider text-on-surface-variant uppercase">
                    <th scope="col" className="px-space-lg py-2 font-semibold">Project</th>
                    <th scope="col" className="w-56 py-2 font-semibold">Completion</th>
                    <th scope="col" className="py-2 text-right font-semibold">Overdue</th>
                    <th scope="col" className="py-2 text-right font-semibold">Estimated</th>
                    <th scope="col" className="py-2 text-right font-semibold">Logged</th>
                    <th scope="col" className="px-space-lg py-2 text-right font-semibold">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {d.projects.map((p) => {
                    const variance = p.estimateHours ? Math.round(((p.actualHours - p.estimateHours) / p.estimateHours) * 100) : null;
                    return (
                      <tr key={p.id} className="border-b border-[#e2e8f0] last:border-0 hover:bg-[#f8fafc]">
                        <td className="px-space-lg py-2.5">
                          <span className="mr-2 font-mono text-code-inline text-outline">{p.keyPrefix}</span>
                          <span className="font-medium text-on-surface">{p.name}</span>
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={p.completionRate} tone={p.completionRate === 100 ? 'success' : 'primary'} label={`${p.name} completion`} />
                            <span className="tabular w-20 shrink-0 text-[12px] text-on-surface-variant">{p.done}/{p.total} · {p.completionRate}%</span>
                          </div>
                        </td>
                        <td className={cn('tabular py-2.5 text-right', p.overdue ? 'font-semibold text-error' : 'text-on-surface-variant')}>{p.overdue}</td>
                        <td className="tabular py-2.5 text-right text-on-surface">{p.estimateHours}h</td>
                        <td className="tabular py-2.5 text-right text-on-surface">{p.actualHours}h</td>
                        <td className={cn('tabular px-space-lg py-2.5 text-right font-semibold', variance === null ? 'text-outline' : variance > 10 ? 'text-error' : 'text-on-surface')}>
                          {variance === null ? '—' : `${variance > 0 ? '+' : ''}${variance}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
