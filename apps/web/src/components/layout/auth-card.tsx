import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';

/**
 * Kerangka halaman auth/onboarding. Stitch tidak memiliki screen login, jadi
 * halaman ini memakai komponen & token Kinetic Slate yang sama (card, input, button).
 */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-gutter py-space-xl">
      <div className="w-full max-w-[420px]">
        <div className="mb-space-lg flex items-center justify-center gap-space-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-on-primary shadow-xs">
            <Icon name="deployed_code" size={22} />
          </span>
          <span className="text-headline-md tracking-tight text-on-surface">Project Tracker</span>
        </div>
        <div className="rounded-xl bg-surface-container-lowest p-space-xl shadow-level-2">
          <h1 className="text-headline-lg tracking-tight text-on-surface">{title}</h1>
          <p className="mt-1 text-body-sm text-on-surface-variant">{subtitle}</p>
          <div className="mt-space-lg">{children}</div>
        </div>
        {footer && <div className="mt-space-md text-center text-body-sm text-on-surface-variant">{footer}</div>}
      </div>
    </main>
  );
}
