'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, onUnauthorized, refreshSession, setAccessToken } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { Me, Session } from '@/lib/types';

type AuthState =
  | { status: 'loading'; me: null }
  | { status: 'authenticated'; me: Me }
  /** `signedOut`: logout eksplisit — jangan simpan ?next (user berikutnya bisa berbeda). */
  | { status: 'unauthenticated'; me: null; signedOut?: boolean };

interface AuthContextValue {
  state: AuthState;
  login: (email: string, password: string) => Promise<Me>;
  register: (input: { email: string; password: string; fullName: string }) => Promise<Me>;
  logout: () => Promise<void>;
  /** Muat ulang profil + daftar workspace (mis. setelah membuat workspace). */
  reloadMe: () => Promise<Me>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', me: null });
  const queryClient = useQueryClient();
  const router = useRouter();

  const loadMe = useCallback(async () => {
    const me = await api<Me>('/auth/me');
    queryClient.setQueryData(qk.me, me);
    setState({ status: 'authenticated', me });
    return me;
  }, [queryClient]);

  const signOutLocally = useCallback(
    (signedOut = false) => {
      setAccessToken(null);
      queryClient.clear();
      setState({ status: 'unauthenticated', me: null, signedOut });
    },
    [queryClient],
  );

  // Bootstrap: pulihkan sesi dari cookie refresh saat halaman dimuat.
  useEffect(() => {
    let cancelled = false;
    refreshSession().then(async (session) => {
      if (cancelled) return;
      if (!session) return setState({ status: 'unauthenticated', me: null });
      try {
        await loadMe();
      } catch {
        if (!cancelled) setState({ status: 'unauthenticated', me: null });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadMe]);

  useEffect(
    () =>
      onUnauthorized(() => {
        signOutLocally();
        router.replace('/login');
      }),
    [router, signOutLocally],
  );

  const startSession = useCallback(
    async (session: Session) => {
      setAccessToken(session.accessToken);
      return loadMe();
    },
    [loadMe],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      login: async (email, password) =>
        startSession(await api<Session>('/auth/login', { method: 'POST', body: { email, password } })),
      register: async (input) =>
        startSession(await api<Session>('/auth/register', { method: 'POST', body: input })),
      logout: async () => {
        await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
        signOutLocally(true);
        router.replace('/login');
      },
      reloadMe: loadMe,
    }),
    [state, startSession, signOutLocally, loadMe, router],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Hanya untuk komponen di dalam AppShell (sesi sudah pasti ada). */
export function useMe(): Me {
  const { state } = useAuth();
  if (state.status !== 'authenticated') throw new Error('useMe requires an authenticated session');
  return state.me;
}
