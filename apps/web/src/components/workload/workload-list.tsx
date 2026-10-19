import { Avatar } from '@/components/ui/avatar';
import { ProgressBar, type ProgressTone } from '@/components/ui/progress';
import { cn } from '@/lib/cn';
import type { WorkloadMember } from '@/lib/types';

const LABEL_TONE: Record<WorkloadMember['label'], { text: string; bar: ProgressTone; status: 'online' | 'busy' | 'focused' }> = {
  Available: { text: 'text-outline', bar: 'primary', status: 'online' },
  Balanced: { text: 'text-primary', bar: 'primary', status: 'online' },
  Healthy: { text: 'text-tertiary-container', bar: 'success', status: 'focused' },
  'High Load': { text: 'text-error', bar: 'danger', status: 'busy' },
};

/** Baris anggota gaya Stitch "Squad Workload": avatar · nama/role · "N tasks (x%)" · label. */
export function WorkloadRow({ member, detailed, capacity = 40 }: { member: WorkloadMember; detailed?: boolean; capacity?: number }) {
  const tone = LABEL_TONE[member.label];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-space-sm">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={member.user.fullName} seed={member.user.id} src={member.user.avatarUrl} size="lg" status={tone.status} />
          <div className="min-w-0">
            <p className="truncate text-label-md text-on-surface">{member.user.fullName}</p>
            <p className="truncate text-[12px] text-on-surface-variant capitalize">
              {member.role}
              {member.overdue > 0 && <span className="text-error normal-case"> · {member.overdue} overdue</span>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end">
          <span className={cn('tabular text-label-sm font-semibold', tone.text)}>
            {member.openTasks} task{member.openTasks === 1 ? '' : 's'} ({member.loadPercent}%)
          </span>
          <span className={cn('text-[11px] font-semibold tracking-[0.04em]', member.label === 'High Load' ? 'text-error' : 'text-outline')}>
            {member.label}
          </span>
        </div>
      </div>
      {detailed && (
        <div className="flex items-center gap-space-sm pl-[42px]">
          <ProgressBar value={Math.min(100, member.loadPercent)} tone={tone.bar} label={`${member.user.fullName} load`} />
          <span className="tabular w-28 shrink-0 text-right text-[11px] text-outline">
            {member.weightedHours}h / {capacity}h
          </span>
        </div>
      )}
    </div>
  );
}
