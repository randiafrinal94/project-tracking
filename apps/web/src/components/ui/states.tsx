import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Button } from './button';
import { Icon } from './icon';

/** Empty state: ikon dalam tile surface-container + judul + deskripsi + aksi. */
export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-space-md py-space-lg' : 'gap-space-md px-space-lg py-12',
        className,
      )}
    >
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-surface-container text-primary',
          compact ? 'h-9 w-9' : 'h-12 w-12',
        )}
      >
        <Icon name={icon} size={compact ? 20 : 24} />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className={cn('text-on-surface', compact ? 'text-label-md font-semibold' : 'text-headline-sm')}>{title}</p>
        {description && <p className="text-body-sm text-on-surface-variant">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Error state dengan pesan dari API (bila ada) dan tombol coba lagi. */
export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
  className,
  compact,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
  compact?: boolean;
}) {
  const message =
    error instanceof ApiError
      ? error.status === 404
        ? 'This item does not exist or you no longer have access to it.'
        : error.message
      : 'Check your connection and try again.';

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-space-md py-space-lg' : 'gap-space-md px-space-lg py-12',
        className,
      )}
    >
      <div className={cn('flex items-center justify-center rounded-xl bg-error-container text-error', compact ? 'h-9 w-9' : 'h-12 w-12')}>
        <Icon name="warning" size={compact ? 20 : 24} />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className={cn('text-on-surface', compact ? 'text-label-md font-semibold' : 'text-headline-sm')}>{title}</p>
        <p className="text-body-sm text-on-surface-variant">{message}</p>
      </div>
      {onRetry && (
        <Button variant="tonal" size="sm" icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
