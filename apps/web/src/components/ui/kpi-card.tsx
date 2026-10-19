import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './icon';
import { Skeleton } from './skeleton';

const ICON_TILE = {
  neutral: 'bg-surface-container text-primary',
  success: 'bg-tertiary-fixed text-tertiary-container',
  danger: 'bg-error-container text-error',
  primary: 'bg-primary-fixed text-primary-container',
} as const;

export interface KpiCardProps {
  label: string;
  icon: string;
  iconTone?: keyof typeof ICON_TILE;
  value: ReactNode;
  /** Teks samping angka utama, mis. trend "+14% vs lw" atau pill. */
  aside?: ReactNode;
  /** Bila true, `aside` diratakan kanan (kartu "Sprint Progress"). */
  asideEnd?: boolean;
  valueClassName?: string;
  description?: ReactNode;
  footer?: ReactNode;
  loading?: boolean;
}

/** Kartu KPI dashboard Stitch (`p-space-lg rounded-xl`, angka `headline-xl`). */
export function KpiCard({
  label,
  icon,
  iconTone = 'neutral',
  value,
  aside,
  asideEnd,
  valueClassName,
  description,
  footer,
  loading,
}: KpiCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-lg shadow-xs transition-shadow hover:shadow-md">
      <div className="mb-space-sm flex items-center justify-between">
        <span className="text-label-md tracking-wider text-on-surface-variant uppercase">{label}</span>
        <div
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg transition-transform group-hover:scale-110',
            ICON_TILE[iconTone],
          )}
        >
          <Icon name={icon} size={18} />
        </div>
      </div>

      {loading ? (
        <div aria-busy className="flex flex-col gap-2 pt-1">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-space-md h-2 w-full" />
        </div>
      ) : (
        <>
          <div className={cn('mb-1 flex items-baseline gap-space-sm', asideEnd && 'justify-between')}>
            <span className={cn('tabular text-headline-xl text-on-surface', valueClassName)}>{value}</span>
            {aside}
          </div>
          {description && <div className="text-body-sm text-on-surface-variant">{description}</div>}
          {footer && <div className="mt-space-md pt-space-xs">{footer}</div>}
        </>
      )}
    </div>
  );
}

/** Indikator tren hijau/merah kecil di samping angka KPI. */
export function KpiTrend({ value, suffix }: { value: number; suffix: string }) {
  const tone = value > 0 ? 'text-tertiary-container' : value < 0 ? 'text-error' : 'text-outline';
  const icon = value > 0 ? 'arrow_upward' : value < 0 ? 'arrow_downward' : 'trending_flat';
  return (
    <span className={cn('flex items-center text-label-sm font-semibold', tone)}>
      <Icon name={icon} size={14} />
      {value > 0 ? '+' : ''}
      {value}
      {suffix}
    </span>
  );
}
