import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { ProjectStatus, TaskPriority, TaskStatus } from '@/lib/types';
import { Icon } from './icon';

// ---------------------------------------------------------------------------
// Priority (kartu Kanban Stitch)
// ---------------------------------------------------------------------------

const PRIORITY: Record<TaskPriority, { label: string; pill: string; dot: string }> = {
  urgent: { label: 'Urgent', pill: 'bg-error-container text-on-error-container', dot: 'bg-error animate-ping' },
  high: { label: 'High', pill: 'bg-high-soft text-on-high-soft', dot: 'bg-high' },
  medium: { label: 'Medium', pill: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-review' },
  low: { label: 'Low', pill: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-outline' },
};

export const priorityLabel = (p: TaskPriority) => PRIORITY[p].label;

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  const p = PRIORITY[priority];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-label-sm',
        priority === 'urgent' && 'gap-1.5',
        priority !== 'low' && 'font-semibold',
        p.pill,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', p.dot)} />
      {p.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Task status (header kolom & drawer Stitch)
// ---------------------------------------------------------------------------

export const TASK_STATUS: Record<
  TaskStatus,
  { label: string; dot: string; bar: string; count: string; pill: string; text: string }
> = {
  backlog: {
    label: 'Backlog',
    dot: 'bg-outline',
    bar: '',
    count: 'bg-surface-container-highest text-on-surface-variant',
    pill: 'bg-surface-container-high text-on-surface-variant',
    text: 'text-on-surface-variant',
  },
  in_progress: {
    label: 'In Progress',
    dot: 'bg-secondary',
    bar: 'bg-secondary',
    count: 'bg-secondary-fixed text-on-secondary-fixed font-bold',
    pill: 'bg-secondary-fixed/50 text-secondary',
    text: 'text-secondary',
  },
  in_review: {
    label: 'In Review',
    dot: 'bg-review',
    bar: 'bg-review',
    count: 'bg-surface-container-highest text-on-surface-variant',
    pill: 'bg-review-soft text-on-review-soft',
    text: 'text-on-review-soft',
  },
  done: {
    label: 'Done',
    dot: 'bg-tertiary-container',
    bar: 'bg-tertiary-container',
    count: 'bg-tertiary-fixed text-on-tertiary-fixed font-bold',
    pill: 'bg-tertiary-fixed text-on-tertiary-fixed',
    text: 'text-tertiary-container',
  },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const s = TASK_STATUS[status];
  return (
    <span className={cn('inline-flex h-7 items-center gap-2 rounded-full px-3 text-label-md font-semibold', s.pill, className)}>
      <span className={cn('h-2 w-2 rounded-full', s.dot)} />
      {s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Project status (pill "Active Sprint" pada header Stitch)
// ---------------------------------------------------------------------------

const PROJECT_STATUS: Record<ProjectStatus, { label: string; pill: string; dot: string }> = {
  active: { label: 'Active', pill: 'bg-tertiary-fixed text-on-tertiary-fixed', dot: 'bg-tertiary-container animate-pulse' },
  planning: { label: 'Planning', pill: 'bg-primary-fixed text-on-primary-fixed', dot: 'bg-primary-container' },
  on_hold: { label: 'On Hold', pill: 'bg-review-soft text-on-review-soft', dot: 'bg-review' },
  completed: { label: 'Completed', pill: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-outline' },
};

export function ProjectStatusBadge({ status, children }: { status: ProjectStatus; children?: ReactNode }) {
  const s = PROJECT_STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-space-sm py-0.5 text-label-sm shadow-xs', s.pill)}>
      <span className={cn('h-2 w-2 rounded-full', s.dot)} />
      {children ?? s.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pill generik & counter
// ---------------------------------------------------------------------------

const PILL_TONE = {
  neutral: 'bg-surface-container text-on-surface-variant',
  strong: 'bg-surface-container-high text-on-surface-variant',
  primary: 'bg-primary-fixed text-on-primary-fixed-variant',
  success: 'bg-tertiary-fixed text-on-tertiary-fixed',
  danger: 'bg-error-container text-on-error-container',
  warning: 'bg-review-soft text-on-review-soft',
} as const;

export function Pill({
  tone = 'neutral',
  icon,
  className,
  children,
}: {
  tone?: keyof typeof PILL_TONE;
  icon?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className={cn('inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-label-sm', PILL_TONE[tone], className)}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

/** Counter kecil di samping label (nav "Projects 8", kolom "Backlog 6"). */
export function CountBadge({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('tabular rounded-full px-1.5 text-[11px] leading-4 font-semibold', className ?? 'bg-surface-container-highest text-on-surface-variant')}>
      {value}
    </span>
  );
}
