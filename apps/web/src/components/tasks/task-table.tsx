'use client';

import { Avatar } from '@/components/ui/avatar';
import { PriorityBadge, TASK_STATUS } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { TagChip } from '@/components/ui/tag-chip';
import { WindowVirtualList } from '@/components/board/virtual-list';
import { cn } from '@/lib/cn';
import { dueLabel, shortDate, timeAgo } from '@/lib/format';
import type { TaskCard, TaskSort } from '@/lib/types';

interface Column {
  id: string;
  label: string;
  sort?: TaskSort;
  className: string;
}

/**
 * Tabel task (Kinetic Slate › Lists & Backlog Rows): baris penuh, divider hairline,
 * hover `#F8FAFC`, key mono → judul → meta. Ter-virtualisasi untuk ribuan baris.
 */
export function TaskTable({
  tasks,
  total,
  showProject,
  sort,
  dir,
  onSort,
  onOpen,
  loading,
  error,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyTitle = 'No tasks found',
  emptyDescription = 'Try clearing filters or create a task from the board.',
}: {
  tasks: TaskCard[];
  total: number;
  showProject?: boolean;
  sort: TaskSort;
  dir: 'asc' | 'desc';
  onSort: (sort: TaskSort) => void;
  onOpen: (task: TaskCard) => void;
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const columns: Column[] = [
    { id: 'key', label: 'Key', sort: 'key', className: 'w-24' },
    { id: 'title', label: 'Title', sort: 'title', className: 'min-w-0 flex-1' },
    ...(showProject ? [{ id: 'project', label: 'Project', className: 'hidden w-40 xl:block' }] : []),
    { id: 'status', label: 'Status', className: 'w-28' },
    { id: 'priority', label: 'Priority', sort: 'priority' as TaskSort, className: 'hidden w-24 md:block' },
    { id: 'assignee', label: 'Assignee', className: 'hidden w-36 lg:block' },
    { id: 'due', label: 'Due', sort: 'due' as TaskSort, className: 'w-28' },
    { id: 'progress', label: 'Subtasks', className: 'hidden w-28 lg:block' },
    { id: 'updated', label: 'Updated', sort: 'updated' as TaskSort, className: 'hidden w-24 2xl:block' },
  ];

  const header = (
    <div role="row" className="flex items-center gap-space-md border-b border-[#e2e8f0] px-space-md py-2">
      {columns.map((c) => {
        const active = c.sort && c.sort === sort;
        return (
          <div
            key={c.id}
            role="columnheader"
            aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
            className={cn('text-label-sm tracking-wider text-on-surface-variant uppercase', c.className)}
          >
            {c.sort ? (
              <button
                type="button"
                onClick={() => onSort(c.sort!)}
                className={cn('flex items-center gap-0.5 uppercase hover:text-on-surface', active && 'text-primary')}
              >
                {c.label}
                <Icon name={active ? (dir === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'unfold_more'} size={14} />
              </button>
            ) : (
              c.label
            )}
          </div>
        );
      })}
    </div>
  );

  const row = (t: TaskCard) => {
    const s = TASK_STATUS[t.status];
    const due = t.dueDate && t.status !== 'done' ? dueLabel(t.dueDate) : null;
    const pct = t.subtasks.total ? Math.round((t.subtasks.completed / t.subtasks.total) * 100) : null;
    return (
      <div
        role="row"
        tabIndex={0}
        aria-label={`${t.key}: ${t.title}`}
        onClick={() => onOpen(t)}
        onKeyDown={(e) => e.key === 'Enter' && onOpen(t)}
        className="group flex cursor-pointer items-center gap-space-md border-b border-[#e2e8f0] px-space-md py-space-sm outline-none transition-colors hover:bg-[#f8fafc] focus-visible:bg-primary-fixed/20"
      >
        <div role="cell" className="w-24 font-mono text-code-inline text-outline group-hover:text-primary">
          {t.key}
        </div>
        <div role="cell" className="flex min-w-0 flex-1 items-center gap-2">
          <span className={cn('truncate text-body-md', t.status === 'done' ? 'text-outline line-through' : 'font-medium text-on-surface')}>
            {t.title}
          </span>
          <span className="hidden shrink-0 gap-1 2xl:flex">
            {t.tags.slice(0, 2).map((g) => (
              <TagChip key={g.id} name={g.name} color={g.color} />
            ))}
            {t.tags.length > 2 && <span className="text-[11px] text-outline">+{t.tags.length - 2}</span>}
          </span>
        </div>
        {showProject && (
          <div role="cell" className="hidden w-40 truncate text-body-sm text-on-surface-variant xl:block">
            {t.projectName}
          </div>
        )}
        <div role="cell" className="w-28">
          <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-label-sm whitespace-nowrap', s.pill)}>
            <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
            {s.label}
          </span>
        </div>
        <div role="cell" className="hidden w-24 md:block">
          <PriorityBadge priority={t.priority} />
        </div>
        <div role="cell" className="hidden w-36 items-center gap-2 lg:flex">
          {t.assignee ? (
            <>
              <Avatar name={t.assignee.fullName} seed={t.assignee.id} src={t.assignee.avatarUrl} size="sm" />
              <span className="truncate text-body-sm text-on-surface">{t.assignee.fullName}</span>
            </>
          ) : (
            <span className="text-body-sm text-outline">Unassigned</span>
          )}
        </div>
        <div
          role="cell"
          className={cn(
            'w-28 text-[12px] font-semibold tracking-[0.02em]',
            due && (due.tone === 'overdue' || due.tone === 'today') ? 'text-error' : 'text-on-surface-variant',
          )}
        >
          {t.status === 'done' ? (
            <span className="text-tertiary-container">Done</span>
          ) : due ? (
            due.label
          ) : t.dueDate ? (
            shortDate(t.dueDate)
          ) : (
            <span className="font-normal text-outline">—</span>
          )}
        </div>
        <div role="cell" className="hidden w-28 items-center gap-2 lg:flex">
          {pct === null ? (
            <span className="text-body-sm text-outline">—</span>
          ) : (
            <>
              <ProgressBar value={pct} tone={pct === 100 ? 'success' : 'primary'} label={`${t.key} subtasks`} />
              <span className="tabular shrink-0 text-[11px] text-outline">
                {t.subtasks.completed}/{t.subtasks.total}
              </span>
            </>
          )}
        </div>
        <div role="cell" className="hidden w-24 font-mono text-[11px] text-outline 2xl:block">
          {timeAgo(t.updatedAt)}
        </div>
      </div>
    );
  };

  return (
    <div role="table" aria-label="Tasks" aria-rowcount={total} className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-xs">
      <div role="rowgroup">{header}</div>
      <div role="rowgroup">
        {loading ? (
          Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex items-center gap-space-md border-b border-[#e2e8f0] px-space-md py-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} title="Could not load tasks" />
        ) : tasks.length === 0 ? (
          <EmptyState icon="checklist" title={emptyTitle} description={emptyDescription} />
        ) : (
          <WindowVirtualList
            items={tasks}
            getKey={(t) => t.id}
            estimateSize={49}
            gap={0}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={onLoadMore}
            loadAhead={20}
            render={row}
          />
        )}
      </div>
      {!loading && tasks.length > 0 && (
        <div className="flex items-center justify-between px-space-md py-2 text-[12px] text-on-surface-variant">
          <span className="tabular">
            Showing {tasks.length} of {total}
          </span>
          {loadingMore && (
            <span className="flex items-center gap-1">
              <Spinner size={12} /> Loading more…
            </span>
          )}
        </div>
      )}
    </div>
  );
}
