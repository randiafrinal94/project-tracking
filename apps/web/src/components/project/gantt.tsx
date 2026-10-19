'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { TASK_STATUS } from '@/components/ui/badge';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { qk } from '@/lib/query-keys';
import type { Milestone, Page, Project, TaskCard, TaskDetail, TaskFilters } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';

const DAY_MS = 86_400_000;
const ROW_H = 40;
const LABEL_W = 280;
const ZOOM = { week: 36, month: 14 } as const;
type Zoom = keyof typeof ZOOM;

/** 'YYYY-MM-DD' ↔ nomor hari UTC (bebas zona waktu). */
const toDay = (iso: string) => Math.floor(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY_MS);
const fromDay = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
const todayDay = () => {
  const n = new Date();
  return Math.floor(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / DAY_MS);
};
const dayDate = (day: number) => new Date(day * DAY_MS);

const BAR_TONE: Record<TaskCard['status'], string> = {
  backlog: 'bg-outline/70',
  in_progress: 'bg-secondary',
  in_review: 'bg-review',
  done: 'bg-tertiary-container',
};

/** Semua task project (tanpa filter status) — Gantt butuh gambaran lengkap. */
function useAllTasks(projectId: string, filters: TaskFilters) {
  return useQuery({
    queryKey: [...qk.projectList(projectId), 'gantt', filters],
    queryFn: async () => {
      const all: TaskCard[] = [];
      let offset: number | null | undefined = 0;
      while (offset !== null && offset !== undefined && all.length < 5000) {
        const page: Page<TaskCard> = await api<Page<TaskCard>>(`/projects/${projectId}/tasks`, {
          query: {
            sort: 'key', limit: 500, offset, q: filters.q, assigneeId: filters.assigneeId,
            priority: filters.priority?.length ? filters.priority : undefined,
            tagId: filters.tagId?.length ? filters.tagId : undefined,
            milestoneId: filters.milestoneId, overdue: filters.overdue || undefined,
          },
        });
        all.push(...page.items);
        offset = page.nextOffset;
      }
      return all;
    },
  });
}

interface Span {
  start: number;
  end: number;
}

const spanOf = (t: { startDate: string | null; dueDate: string | null }): Span | null => {
  if (!t.startDate && !t.dueDate) return null;
  const start = toDay(t.startDate ?? t.dueDate!);
  const end = toDay(t.dueDate ?? t.startDate!);
  return { start: Math.min(start, end), end: Math.max(start, end) };
};

export function GanttTimeline({
  project,
  milestones,
  filters,
  canEdit,
  onOpenTask,
}: {
  project: Project;
  milestones: Milestone[];
  filters: TaskFilters;
  canEdit: boolean;
  onOpenTask: (taskId: string) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const tasks = useAllTasks(project.id, filters);
  const [zoom, setZoom] = useState<Zoom>('week');
  const [drafts, setDrafts] = useState<Record<string, Span>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const dayW = ZOOM[zoom];

  const reschedule = useMutation({
    mutationFn: ({ id, span }: { id: string; span: Span }) =>
      api<TaskDetail>(`/tasks/${id}`, { method: 'PATCH', body: { startDate: fromDay(span.start), dueDate: fromDay(span.end) } }),
    onSuccess: (task) => {
      queryClient.setQueryData(qk.task(task.id), task);
      queryClient.invalidateQueries({ queryKey: qk.tasks(project.id) });
      toast({ tone: 'success', title: `${task.key} rescheduled`, description: `${fromDay(spanOf(task)!.start)} → ${task.dueDate}` });
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not reschedule', description: (e as Error).message }),
    onSettled: (_r, _e, v) =>
      setDrafts(({ [v.id]: _drop, ...rest }) => rest),
  });

  const { range, groups, unscheduled } = useMemo(() => {
    const list = tasks.data ?? [];
    const scheduled = list.filter((t) => spanOf(t));
    const days: number[] = [todayDay()];
    for (const t of scheduled) {
      const s = spanOf(t)!;
      days.push(s.start, s.end);
    }
    for (const m of milestones) {
      if (m.startDate) days.push(toDay(m.startDate));
      if (m.dueDate) days.push(toDay(m.dueDate));
    }
    if (project.startDate) days.push(toDay(project.startDate));
    if (project.targetDate) days.push(toDay(project.targetDate));
    const start = Math.min(...days) - 3;
    const end = Math.max(...days) + 10;

    const byMilestone = new Map<string | null, TaskCard[]>();
    for (const t of scheduled) {
      const k = t.milestoneId;
      byMilestone.set(k, [...(byMilestone.get(k) ?? []), t]);
    }
    const order = [...milestones].sort((a, b) => (a.startDate ?? a.dueDate ?? '9').localeCompare(b.startDate ?? b.dueDate ?? '9'));
    const g = [
      ...order.map((m) => ({ milestone: m as Milestone | null, tasks: byMilestone.get(m.id) ?? [] })),
      { milestone: null as Milestone | null, tasks: byMilestone.get(null) ?? [] },
    ].filter((x) => x.tasks.length > 0 || (x.milestone && (x.milestone.startDate || x.milestone.dueDate)));
    for (const x of g) x.tasks.sort((a, b) => spanOf(a)!.start - spanOf(b)!.start);

    return { range: { start, end }, groups: g, unscheduled: list.filter((t) => !spanOf(t)) };
  }, [tasks.data, milestones, project.startDate, project.targetDate]);

  const totalDays = range.end - range.start + 1;
  const x = (day: number) => (day - range.start) * dayW;

  // Buka timeline dengan "hari ini" terlihat (sedikit ke kiri dari tengah).
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    const key = `${zoom}:${range.start}`;
    if (!el || !tasks.data || scrolledFor.current === key) return;
    scrolledFor.current = key;
    el.scrollLeft = Math.max(0, LABEL_W + x(todayDay()) - el.clientWidth * 0.35);
  });

  /** Drag bar: geser (body) atau ubah ukuran (tepi kiri/kanan), snap per hari. */
  const startDrag = (e: ReactPointerEvent, task: TaskCard, mode: 'move' | 'start' | 'end') => {
    if (!canEdit) return;
    e.preventDefault();
    e.stopPropagation();
    const origin = spanOf(task)!;
    const startX = e.clientX;
    let moved = false;
    let current = origin;

    const onMove = (ev: PointerEvent) => {
      const delta = Math.round((ev.clientX - startX) / dayW);
      if (delta !== 0) moved = true;
      current =
        mode === 'move'
          ? { start: origin.start + delta, end: origin.end + delta }
          : mode === 'start'
            ? { start: Math.min(origin.start + delta, origin.end), end: origin.end }
            : { start: origin.start, end: Math.max(origin.end + delta, origin.start) };
      setDrafts((d) => ({ ...d, [task.id]: current }));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!moved) {
        setDrafts(({ [task.id]: _drop, ...rest }) => rest);
        onOpenTask(task.id);
        return;
      }
      if (current.start !== origin.start || current.end !== origin.end) reschedule.mutate({ id: task.id, span: current });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  if (tasks.isLoading) return <Skeleton className="h-[420px] w-full rounded-xl" />;
  if (tasks.isError) return <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} title="Could not load timeline" />;

  // Header: bulan + (minggu: tanggal | bulan: awal minggu)
  const months: { label: string; from: number; days: number }[] = [];
  for (let d = range.start; d <= range.end; d++) {
    const date = dayDate(d);
    const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const last = months[months.length - 1];
    if (last?.label === label) last.days++;
    else months.push({ label, from: d, days: 1 });
  }
  const today = todayDay();
  const rowsHeight = groups.reduce((h, g) => h + ROW_H * (g.tasks.length + 1), 0);

  return (
    <div className="flex flex-col gap-space-md">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <p className="text-body-sm text-on-surface-variant">
          {canEdit ? 'Drag a bar to move it, or its edges to change start/due dates.' : 'Timeline of scheduled tasks.'}
        </p>
        <SegmentedTabs
          label="Zoom"
          active={zoom}
          onChange={(id) => setZoom(id as Zoom)}
          tabs={[
            { id: 'week', label: 'Days', icon: 'calendar_view_day' },
            { id: 'month', label: 'Weeks', icon: 'calendar_view_week' },
          ]}
        />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl bg-surface-container-lowest shadow-xs">
          <EmptyState icon="waterfall_chart" title="Nothing scheduled yet" description="Give tasks a start or due date to see them on the timeline." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-xs">
          <div ref={scrollRef} className="overflow-x-auto">
            <div className="relative" style={{ width: LABEL_W + totalDays * dayW }}>
              {/* Header */}
              <div className="sticky top-0 z-20 flex border-b border-[#e2e8f0] bg-surface-container-lowest">
                <div className="sticky left-0 z-10 flex shrink-0 items-end border-r border-[#e2e8f0] bg-surface-container-lowest px-space-md pb-1 text-label-sm tracking-wider text-on-surface-variant uppercase" style={{ width: LABEL_W }}>
                  Task
                </div>
                <div className="flex flex-col">
                  <div className="flex h-6">
                    {months.map((m) => (
                      <div key={m.from} className="truncate border-r border-[#e2e8f0] px-2 text-[11px] font-semibold text-on-surface" style={{ width: m.days * dayW }}>
                        {m.label}
                      </div>
                    ))}
                  </div>
                  <div className="flex h-6">
                    {Array.from({ length: totalDays }, (_, i) => {
                      const d = range.start + i;
                      const date = dayDate(d);
                      const dow = date.getUTCDay();
                      const show = zoom === 'week' || dow === 1;
                      return (
                        <div
                          key={d}
                          className={cn('shrink-0 text-center font-mono text-[10px] leading-6', d === today ? 'font-bold text-primary' : 'text-outline', (dow === 0 || dow === 6) && zoom === 'week' && 'bg-surface-container-low/60')}
                          style={{ width: dayW }}
                        >
                          {show ? date.getUTCDate() : ''}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Today line */}
              <div aria-hidden className="pointer-events-none absolute z-10 w-px bg-primary-container" style={{ left: LABEL_W + x(today) + dayW / 2, top: 48, height: rowsHeight }} />

              {groups.map((g) => {
                const ms = g.milestone;
                const msSpan = ms ? spanOf({ startDate: ms.startDate, dueDate: ms.dueDate }) : null;
                return (
                  <div key={ms?.id ?? 'none'} role="rowgroup" aria-label={ms?.name ?? 'No milestone'}>
                    <div className="flex border-b border-[#e2e8f0] bg-surface-container-low/60" style={{ height: ROW_H }}>
                      <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-[#e2e8f0] bg-surface-container-low px-space-md" style={{ width: LABEL_W }}>
                        <span className={cn('material-symbols-outlined text-[16px]', ms ? 'text-tertiary-container' : 'text-outline')}>flag</span>
                        <span className="truncate text-label-md font-semibold text-on-surface">{ms?.name ?? 'No milestone'}</span>
                        {ms && <span className="tabular ml-auto text-[11px] text-outline">{ms.progress.percent}%</span>}
                      </div>
                      <div className="relative flex-1">
                        {msSpan && (
                          <div
                            className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-tertiary-container/25"
                            style={{ left: x(msSpan.start), width: (msSpan.end - msSpan.start + 1) * dayW }}
                            title={`${ms!.name}: ${ms!.startDate ?? '?'} → ${ms!.dueDate ?? '?'}`}
                          >
                            <div className="h-full rounded-full bg-tertiary-container" style={{ width: `${ms!.progress.percent}%` }} />
                          </div>
                        )}
                      </div>
                    </div>

                    {g.tasks.map((t) => {
                      const span = drafts[t.id] ?? spanOf(t)!;
                      const width = (span.end - span.start + 1) * dayW;
                      const overdue = t.status !== 'done' && t.dueDate && toDay(t.dueDate) < today;
                      return (
                        <div key={t.id} role="row" className="group flex border-b border-[#e2e8f0] hover:bg-[#f8fafc]" style={{ height: ROW_H }}>
                          <button
                            type="button"
                            onClick={() => onOpenTask(t.id)}
                            className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-[#e2e8f0] bg-surface-container-lowest px-space-md text-left group-hover:bg-[#f8fafc]"
                            style={{ width: LABEL_W }}
                          >
                            <span className="w-14 shrink-0 font-mono text-code-inline text-outline">{t.key}</span>
                            <span className={cn('truncate text-body-sm', t.status === 'done' ? 'text-outline line-through' : 'text-on-surface')}>{t.title}</span>
                          </button>
                          <div className="relative flex-1">
                            <div
                              role="button"
                              tabIndex={0}
                              aria-label={`${t.key} ${t.title}: ${fromDay(span.start)} to ${fromDay(span.end)}, ${TASK_STATUS[t.status].label}`}
                              onPointerDown={(e) => startDrag(e, t, 'move')}
                              onKeyDown={(e) => e.key === 'Enter' && onOpenTask(t.id)}
                              className={cn(
                                'absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md text-[11px] font-semibold text-white shadow-xs transition-shadow hover:shadow-md',
                                BAR_TONE[t.status],
                                overdue && 'ring-2 ring-error/60',
                                canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                                drafts[t.id] && 'opacity-80 ring-2 ring-primary-container',
                              )}
                              style={{ left: x(span.start), width: Math.max(width, dayW) }}
                            >
                              {canEdit && (
                                <span aria-hidden onPointerDown={(e) => startDrag(e, t, 'start')} className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize bg-black/10" />
                              )}
                              <span className="truncate px-2">{width > 70 ? t.title : ''}</span>
                              {canEdit && (
                                <span aria-hidden onPointerDown={(e) => startDrag(e, t, 'end')} className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize bg-black/10" />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div className="rounded-xl bg-surface-container-lowest p-space-md shadow-xs">
          <h3 className="mb-space-sm flex items-center gap-2 text-headline-sm text-on-surface">
            <span className="material-symbols-outlined text-[18px] text-outline">event_busy</span>
            Unscheduled <span className="rounded-full bg-surface-container px-2 text-label-sm text-on-surface-variant">{unscheduled.length}</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {unscheduled.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpenTask(t.id)}
                className="flex max-w-xs items-center gap-2 rounded-lg bg-surface-container-low px-2.5 py-1.5 text-left text-body-sm text-on-surface hover:bg-surface-container"
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', TASK_STATUS[t.status].dot)} />
                <span className="font-mono text-code-inline text-outline">{t.key}</span>
                <span className="truncate">{t.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
