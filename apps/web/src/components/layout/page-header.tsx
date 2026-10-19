import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';

/**
 * Header halaman Stitch: tile ikon 40px `bg-primary-container`, judul `headline-lg`,
 * badge status di samping judul, baris meta `body-sm`, dan grup aksi di kanan.
 */
export function PageHeader({
  icon,
  title,
  badge,
  meta,
  actions,
  children,
}: {
  icon: string;
  title: string;
  badge?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Baris tambahan (tabs + filter bar). */
  children?: ReactNode;
}) {
  return (
    <header className="mb-space-xl flex flex-col gap-space-md">
      <div className="flex flex-wrap items-center justify-between gap-gutter">
        <div className="flex min-w-0 flex-wrap items-center gap-space-md">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-xs">
            <Icon name={icon} size={24} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-space-sm">
              <h1 className="text-headline-lg-mobile tracking-tight text-on-surface md:text-headline-lg">{title}</h1>
              {badge}
            </div>
            {meta && (
              <div className="mt-1 flex flex-wrap items-center gap-space-md text-body-sm text-on-surface-variant">{meta}</div>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-space-sm">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** Titik pemisah 4px di baris meta. */
export const MetaDot = () => <span className="h-1 w-1 rounded-full bg-outline-variant" />;
