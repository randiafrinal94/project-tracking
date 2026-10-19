'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { PriorityBadge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { ProgressBar, type ProgressTone } from '@/components/ui/progress';
import { TagChip } from '@/components/ui/tag-chip';
import { cn } from '@/lib/cn';
import { dueLabel, timeAgo } from '@/lib/format';
import type { TaskCard as Task } from '@/lib/types';

const PROGRESS_TONE: Record<Task['status'], ProgressTone> = {
  backlog: 'primary',
  in_progress: 'info',
  in_review: 'success',
  done: 'success',
};

interface TaskCardProps extends HTMLAttributes<HTMLElement> {
  task: Task;
  /** Kartu sedang diangkat (DragOverlay). */
  overlay?: boolean;
  /** Placeholder di posisi asal selama drag. */
  ghost?: boolean;
}

/**
 * Kartu Kanban Stitch: priority pill + key mono, judul headline-sm, tag, progress
 * subtask, footer (due · komentar · avatar). Kartu Done: pill Resolved + judul dicoret.
 */
export const TaskCard = forwardRef<HTMLElement, TaskCardProps>(function TaskCard(
  { task, overlay, ghost, className, ...props },
  ref,
) {
  const done = task.status === 'done';
  const { total, completed } = task.subtasks;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const due = task.dueDate && !done ? dueLabel(task.dueDate) : null;
  const urgentDue = due && (due.tone === 'overdue' || due.tone === 'today');

  return (
    <article
      ref={ref}
      aria-label={`${task.key}: ${task.title}`}
      className={cn(
        'group cursor-pointer rounded-lg p-space-md shadow-xs outline-none transition-all',
        done ? 'bg-surface-container-lowest/80 opacity-95 hover:opacity-100' : 'bg-surface-container-lowest hover:-translate-y-0.5',
        'hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-container/35',
        overlay && 'rotate-[1.5deg] cursor-grabbing opacity-100 shadow-level-2 ring-1 ring-[#cbd5e1]',
        ghost && 'opacity-40 shadow-none ring-2 ring-primary-container/30',
        className,
      )}
      {...props}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        {done ? (
          <span className="flex items-center gap-1 rounded-full bg-tertiary-fixed px-2 py-0.5 text-label-sm font-semibold text-on-tertiary-fixed">
            <Icon name="check" size={14} />
            Resolved
          </span>
        ) : (
          <PriorityBadge priority={task.priority} />
        )}
        <span className="font-mono text-code-inline text-outline transition-colors group-hover:text-primary">{task.key}</span>
      </div>

      <h3
        className={cn(
          'mb-2 text-headline-sm leading-snug transition-colors',
          done ? 'text-outline line-through' : 'text-on-surface group-hover:text-primary',
        )}
      >
        {task.title}
      </h3>

      {task.tags.length > 0 && (
        <div className="mb-space-md flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <TagChip key={tag.id} name={tag.name} color={tag.color} />
          ))}
        </div>
      )}

      {total > 0 && !done && (
        <div className="mb-space-md">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold tracking-[0.04em] text-outline">
            <span>Subtasks</span>
            <span className={cn('tabular', pct === 100 ? 'text-tertiary-container' : pct >= 50 && 'font-bold text-on-surface')}>
              {completed}/{total} {pct === 100 ? 'ready' : `(${pct}%)`}
            </span>
          </div>
          <ProgressBar value={pct} tone={pct === 100 ? 'success' : PROGRESS_TONE[task.status]} label={`${task.key} subtasks`} />
        </div>
      )}

      <div className="flex items-center justify-between pt-space-xs text-body-sm text-on-surface-variant">
        {done ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold tracking-[0.04em] text-tertiary-container">
            <Icon name="verified" size={15} />
            {task.completedAt ? `Done ${timeAgo(task.completedAt)}` : 'Done'}
          </span>
        ) : due ? (
          <span
            className={cn(
              'flex items-center gap-1 text-[11px] tracking-[0.04em]',
              urgentDue ? 'font-semibold text-error' : due.tone === 'soon' ? 'font-semibold text-on-surface-variant' : 'font-semibold text-outline',
            )}
          >
            <Icon name={urgentDue ? 'alarm' : 'event'} size={15} />
            {due.label}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-space-sm">
          {task.commentCount > 0 && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-outline" aria-label={`${task.commentCount} comments`}>
              <Icon name="chat_bubble" size={14} /> {task.commentCount}
            </span>
          )}
          {task.attachmentCount > 0 && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-outline" aria-label={`${task.attachmentCount} attachments`}>
              <Icon name="attach_file" size={14} /> {task.attachmentCount}
            </span>
          )}
          {task.estimateHours !== null && !done && (
            <span className="flex items-center gap-1 font-mono text-[11px] text-outline" aria-label={`${task.estimateHours} hours estimated`}>
              <Icon name="schedule" size={14} /> {task.estimateHours}h
            </span>
          )}
          {task.assignee ? (
            <Avatar name={task.assignee.fullName} seed={task.assignee.id} src={task.assignee.avatarUrl} size="sm" />
          ) : (
            <span
              title="Unassigned"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-outline-variant text-outline"
            >
              <Icon name="person" size={14} />
            </span>
          )}
        </div>
      </div>
    </article>
  );
});
