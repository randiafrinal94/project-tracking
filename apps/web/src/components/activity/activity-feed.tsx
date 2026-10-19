import type { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { TASK_STATUS } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import type { ActivityItem, TaskStatus } from '@/lib/types';

/** Lencana kecil di pojok avatar (Stitch: → moved, ✓ resolved, + added). */
const BADGE: Record<string, { glyph: string; className: string }> = {
  moved: { glyph: '→', className: 'bg-review' },
  done: { glyph: '✓', className: 'bg-tertiary-container' },
  created: { glyph: '+', className: 'bg-secondary-container' },
  comment: { glyph: '“', className: 'bg-primary-container' },
  removed: { glyph: '–', className: 'bg-error' },
  updated: { glyph: '•', className: 'bg-outline' },
};

const meta = (item: ActivityItem) => item.metadata as Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function StatusChip({ status }: { status: string }) {
  const s = TASK_STATUS[status as TaskStatus];
  if (!s) return <span>{status}</span>;
  return <span className={cn('whitespace-nowrap rounded px-1 text-[11px] font-semibold', s.pill)}>{s.label}</span>;
}

/** Kalimat aktivitas: aktor (bold) + kata kerja + target (primary). */
function describe(item: ActivityItem): { text: ReactNode; badge: keyof typeof BADGE } {
  const m = meta(item);
  const key = str(m.key);
  const target = (label: string) => <span className="font-medium text-primary">{label}</span>;
  const taskLabel = target(key ? `${key} ${str(m.title)}`.trim() : str(m.title) || 'a task');

  switch (item.action) {
    case 'task.created':
      return { text: <>created {taskLabel}</>, badge: 'created' };
    case 'task.moved':
      return {
        text: (
          <>
            moved {target(key || str(m.title))} to <StatusChip status={str(m.to)} />
          </>
        ),
        badge: m.to === 'done' ? 'done' : 'moved',
      };
    case 'task.assigned':
      return { text: <>{m.to ? 'reassigned' : 'unassigned'} {taskLabel}</>, badge: 'updated' };
    case 'task.priority_changed':
      return { text: <>set priority of {target(key)} to <strong className="font-semibold">{str(m.to)}</strong></>, badge: 'updated' };
    case 'task.updated':
      return { text: <>updated {taskLabel}</>, badge: 'updated' };
    case 'task.deleted':
      return { text: <>deleted {taskLabel}</>, badge: 'removed' };
    case 'task.restored':
      return { text: <>restored {taskLabel}</>, badge: 'created' };
    case 'task.tag_added':
      return { text: <>tagged {target(key)} with <strong className="font-semibold">{str(m.tag)}</strong></>, badge: 'updated' };
    case 'task.tag_removed':
      return { text: <>removed tag <strong className="font-semibold">{str(m.tag)}</strong> from {target(key)}</>, badge: 'removed' };
    case 'subtask.completed':
      return { text: <>completed “{str(m.title)}” on {target(key)}</>, badge: 'done' };
    case 'subtask.created':
      return { text: <>added a subtask to {target(key)}</>, badge: 'created' };
    case 'subtask.reopened':
      return { text: <>reopened “{str(m.title)}” on {target(key)}</>, badge: 'moved' };
    case 'subtask.deleted':
      return { text: <>removed a subtask from {target(key)}</>, badge: 'removed' };
    case 'comment.created':
      return { text: <>commented on {target(key)}</>, badge: 'comment' };
    case 'comment.edited':
      return { text: <>edited a comment on {target(key)}</>, badge: 'comment' };
    case 'comment.deleted':
      return { text: <>deleted a comment on {target(key)}</>, badge: 'removed' };
    case 'attachment.added':
      return { text: <>attached <strong className="font-semibold">{str(m.fileName)}</strong> to {target(key)}</>, badge: 'created' };
    case 'attachment.removed':
      return { text: <>removed <strong className="font-semibold">{str(m.fileName)}</strong> from {target(key)}</>, badge: 'removed' };
    case 'project.created':
      return { text: <>created project {target(str(m.name))}</>, badge: 'created' };
    case 'project.status_changed':
      return { text: <>changed {target(str(m.name))} to <strong className="font-semibold">{str(m.to).replace('_', ' ')}</strong></>, badge: 'moved' };
    case 'project.deleted':
      return { text: <>archived project {target(str(m.name))}</>, badge: 'removed' };
    case 'milestone.created':
      return { text: <>added milestone {target(str(m.name))}</>, badge: 'created' };
    case 'milestone.completed':
      return { text: <>completed milestone {target(str(m.name))}</>, badge: 'done' };
    default:
      return { text: <>{item.action.replace('.', ' ').replace('_', ' ')}</>, badge: 'updated' };
  }
}

export function ActivityFeed({
  items,
  loading,
  error,
  onRetry,
}: {
  items?: ActivityItem[];
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (loading) {
    return (
      <div aria-busy className="flex flex-col gap-space-md">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-space-sm">
            <Skeleton className="h-7 w-7 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error) return <ErrorState compact error={error} onRetry={onRetry} title="Activity unavailable" />;
  if (!items?.length) {
    return <EmptyState compact icon="bolt" title="No activity yet" description="Changes to projects and tasks will appear here." />;
  }

  return (
    <ol className="flex flex-col gap-space-md">
      {items.map((item) => {
        const { text, badge } = describe(item);
        const b = BADGE[badge]!;
        return (
          <li key={item.id} className="flex items-start gap-space-sm">
            <div className="relative mt-0.5 shrink-0">
              <Avatar name={item.actor?.fullName ?? 'System'} seed={item.actor?.id} src={item.actor?.avatarUrl} size="md" />
              <span
                aria-hidden
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full text-[7px] text-white ring-2 ring-surface-container-lowest',
                  b.className,
                )}
              >
                {b.glyph}
              </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="text-body-sm text-on-surface">
                <strong className="font-semibold text-on-surface">{item.actor?.fullName ?? 'System'}</strong> {text}
              </p>
              <time dateTime={item.createdAt} className="mt-0.5 font-mono text-[10px] text-outline">
                {timeAgo(item.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
