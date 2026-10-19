'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullScreenLoader } from '@/components/layout/auth-gate';
import { useAuth } from '@/providers/auth-provider';

/** Entry: arahkan ke workspace pertama, onboarding, atau login. */
export default function Home() {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === 'unauthenticated') router.replace('/login');
    if (state.status === 'authenticated') {
      const first = state.me.workspaces[0];
      router.replace(first ? `/${first.slug}` : '/onboarding');
    }
  }, [state, router]);

  return <FullScreenLoader />;
}
