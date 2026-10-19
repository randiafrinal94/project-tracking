'use client';

import { useEffect, useState } from 'react';
import { TASK_STATUS, priorityLabel } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { STATUSES } from '@/hooks/board';
import { cn } from '@/lib/cn';
import type { Project, TaskFilters, TaskPriority, TaskStatus } from '@/lib/types';

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

const selectClass =
  'h-8 rounded-lg bg-surface-container-lowest px-2 text-body-sm text-on-surface shadow-xs focus:outline-none focus:ring-2 focus:ring-primary-container/20';

/** Filter halaman Tasks (lintas project): scope saya/semua, project, status, prioritas, cari. */
export function WorkspaceTaskFilters({
  filters,
  onChange,
  projects,
  showStatus = true,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  projects: Project[];
  showStatus?: boolean;
}) {
  const [q, setQ] = useState(filters.q ?? '');
  useEffect(() => {
    const id = setTimeout(() => {
      const value = q.trim() || undefined;
      if (value !== filters.q) onChange({ ...filters, q: value });
    }, 300);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const scope = filters.assigneeId === 'me' ? 'mine' : filters.assigneeId === 'unassigned' ? 'unassigned' : 'all';

  return (
    <div className="flex flex-col items-stretch justify-between gap-space-md lg:flex-row lg:items-center">
      <div className="overflow-x-auto no-scrollbar">
        <SegmentedTabs
          label="Whose tasks"
          active={scope}
          onChange={(id) => onChange({ ...filters, assigneeId: id === 'mine' ? 'me' : id === 'unassigned' ? 'unassigned' : undefined })}
          tabs={[
            { id: 'mine', label: 'My tasks', icon: 'person' },
            { id: 'all', label: 'All tasks', icon: 'groups' },
            { id: 'unassigned', label: 'Unassigned', icon: 'person_off' },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center gap-space-sm lg:justify-end">
        <Input icon="search" inputSize="sm" type="search" aria-label="Search tasks" placeholder="Search title or key…" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-56" />
        <select aria-label="Project" className={selectClass} value={filters.projectId ?? ''} onChange={(e) => onChange({ ...filters, projectId: e.target.value || undefined })}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.keyPrefix} · {p.name}
            </option>
          ))}
        </select>
        {showStatus && (
          <select aria-label="Status" className={selectClass} value={filters.status ?? ''} onChange={(e) => onChange({ ...filters, status: (e.target.value || undefined) as TaskStatus | undefined })}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{TASK_STATUS[s].label}</option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1" role="group" aria-label="Priority">
          {PRIORITIES.map((p) => {
            const active = filters.priority?.includes(p) ?? false;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ ...filters, priority: active ? filters.priority!.filter((x) => x !== p) : [...(filters.priority ?? []), p] })}
                className={cn(
                  'rounded-full px-2.5 py-1 text-label-sm transition-colors',
                  active ? 'bg-primary-fixed/60 text-on-primary-fixed-variant' : 'bg-surface-container-lowest text-on-surface-variant shadow-xs hover:bg-surface-container',
                )}
              >
                {priorityLabel(p)}
              </button>
            );
          })}
        </div>
        <label className="flex items-center gap-1.5 text-label-sm text-on-surface-variant">
          <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary-container)]" checked={!!filters.overdue} onChange={(e) => onChange({ ...filters, overdue: e.target.checked || undefined })} />
          Overdue
        </label>
      </div>
    </div>
  );
}
