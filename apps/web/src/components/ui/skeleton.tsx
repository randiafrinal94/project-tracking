import { cn } from '@/lib/cn';

/** Placeholder loading dengan shimmer lembut di atas surface-container. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-shimmer rounded-lg bg-surface-container bg-[length:800px_100%]',
        'bg-[linear-gradient(90deg,var(--color-surface-container)_0%,var(--color-surface-container-low)_50%,var(--color-surface-container)_100%)]',
        className,
      )}
    />
  );
}
