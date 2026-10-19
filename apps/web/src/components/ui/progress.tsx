import { cn } from '@/lib/cn';

const TONES = {
  primary: 'bg-primary-container',
  info: 'bg-secondary',
  success: 'bg-tertiary-container',
  warning: 'bg-review',
  danger: 'bg-error',
} as const;

export type ProgressTone = keyof typeof TONES;

interface ProgressBarProps {
  value: number;
  tone?: ProgressTone;
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
}

/** Track `bg-surface-container` + fill rounded (subtask, KPI, milestone Stitch). */
export function ProgressBar({ value, tone = 'primary', size = 'sm', className, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('w-full overflow-hidden rounded-full bg-surface-container', size === 'sm' ? 'h-1.5' : 'h-2', className)}
    >
      <div className={cn('h-full rounded-full transition-all duration-700', TONES[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}
