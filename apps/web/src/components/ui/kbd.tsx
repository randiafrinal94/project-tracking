import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'rounded bg-surface-container px-1.5 py-0.5 font-mono text-code-inline text-on-surface-variant',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
