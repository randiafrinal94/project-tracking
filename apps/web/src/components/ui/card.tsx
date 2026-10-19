import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Icon } from './icon';

/** Panel rail Stitch: `p-space-lg rounded-xl bg-surface-container-lowest shadow-sm`. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl bg-surface-container-lowest p-space-lg shadow-xs', className)} {...props} />;
}

const ICON_TONE = {
  primary: 'text-primary',
  info: 'text-secondary',
  success: 'text-tertiary-container',
  danger: 'text-error',
} as const;

/** Judul panel: ikon 20px + `headline-sm`, aksi/kanan opsional. */
export function CardHeader({
  icon,
  iconTone = 'primary',
  title,
  aside,
  className,
}: {
  icon?: string;
  iconTone?: keyof typeof ICON_TONE;
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-space-md flex items-center justify-between gap-space-sm', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon && <Icon name={icon} size={20} className={ICON_TONE[iconTone]} />}
        <h3 className="truncate text-headline-sm text-on-surface">{title}</h3>
      </div>
      {aside}
    </div>
  );
}
