'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { useAuth } from '@/providers/auth-provider';

/** Layar tunggu saat sesi dipulihkan dari cookie refresh. */
export function FullScreenLoader({ label = 'Loading workspace…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-space-md bg-background text-on-surface-variant">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-on-primary shadow-xs">
        <Icon name="deployed_code" size={24} />
      </span>
      <div className="flex items-center gap-2 text-body-sm">
        <Spinner size={14} />
        {label}
      </div>
    </div>
  );
}

/** Melindungi route aplikasi: tanpa sesi → /login?next=<path>. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status !== 'unauthenticated') return;
    // Sesi kedaluwarsa → kembali ke halaman ini setelah login; logout eksplisit → /login bersih.
    router.replace(state.signedOut ? '/login' : `/login?next=${encodeURIComponent(pathname)}`);
  }, [state, router, pathname]);

  if (state.status !== 'authenticated') return <FullScreenLoader />;
  return <>{children}</>;
}
