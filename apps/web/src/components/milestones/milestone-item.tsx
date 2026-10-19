import { Pill } from '@/components/ui/badge';
import { ProgressBar, type ProgressTone } from '@/components/ui/progress';
import { daysFromToday, shortDate } from '@/lib/format';
import type { Milestone } from '@/lib/types';

function dueInfo(m: Milestone): { label: string; tone: 'primary' | 'strong' | 'danger' | 'success' } {
  if (m.isCompleted) return { label: 'Completed', tone: 'success' };
  if (!m.dueDate) return { label: 'No due date', tone: 'strong' };
  const days = daysFromToday(m.dueDate);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: 'danger' };
  if (days === 0) return { label: 'Due today', tone: 'danger' };
  return { label: `${days} day${days === 1 ? '' : 's'} left`, tone: days <= 3 ? 'primary' : 'strong' };
}

/** Item milestone pada rail "Upcoming Milestones" Stitch. */
export function MilestoneItem({ milestone, subtitle }: { milestone: Milestone; subtitle?: string }) {
  const due = dueInfo(milestone);
  const tone: ProgressTone = milestone.isCompleted
    ? 'success'
    : due.tone === 'danger'
      ? 'danger'
      : milestone.progress.percent >= 50
        ? 'primary'
        : 'warning';

  return (
    <div className="rounded-lg bg-surface-container-low p-space-md transition-colors hover:bg-surface-container">
      <div className="mb-1.5 flex items-center justify-between gap-space-sm">
        <span className="truncate text-label-md font-semibold text-on-surface">{milestone.name}</span>
        <Pill tone={due.tone} className="text-[11px] font-bold">
          {due.label}
        </Pill>
      </div>
      {(milestone.description || subtitle) && (
        <p className="mb-space-sm line-clamp-2 text-body-sm text-on-surface-variant">{milestone.description ?? subtitle}</p>
      )}
      <ProgressBar value={milestone.progress.percent} tone={tone} className="mb-1" label={`${milestone.name} progress`} />
      <div className="flex justify-between text-[11px] font-semibold tracking-[0.04em] text-outline">
        <span className="tabular">{milestone.progress.percent}% complete</span>
        {milestone.dueDate && <span>Due {shortDate(milestone.dueDate)}</span>}
      </div>
    </div>
  );
}
