'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/layout/auth-card';
import { FullScreenLoader } from '@/components/layout/auth-gate';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Field, Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import type { Me } from '@/lib/types';
import { NoWorkspaceError, useAuth } from '@/providers/auth-provider';

/** Hanya izinkan redirect internal (mencegah open redirect lewat ?next=). */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : null);

interface Notice {
  icon: string;
  title: string;
  message: string;
}

const REGISTERED_NOTICE: Notice = {
  icon: 'check_circle',
  title: 'Registration successful',
  message:
    'Your account has been created. You will be able to sign in once a workspace owner has added you to a workspace.',
};

const NO_WORKSPACE_NOTICE: Notice = {
  icon: 'info',
  title: 'No workspace assigned',
  message:
    'Your account has not been assigned to any workspace yet. Please contact your workspace owner or administrator to request access.',
};

const landingFor = (me: Me, next: string | null) =>
  safeNext(next) ?? (me.workspaces[0] ? `/${me.workspaces[0].slug}` : '/onboarding');

function LoginForm() {
  const id = useId();
  const router = useRouter();
  const params = useSearchParams();
  const { state, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (state.status === 'authenticated') router.replace(landingFor(state.me, params.get('next')));
  }, [state, router, params]);

  if (state.status !== 'unauthenticated') return <FullScreenLoader />;

  // Sesi ditolak di luar form (mis. memulihkan sesi / keluar dari workspace terakhir).
  const shownNotice = notice ?? (state.noWorkspace && !error ? NO_WORKSPACE_NOTICE : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setFieldErrors({});
    setPending(true);
    try {
      if (mode === 'register') {
        await register({ email, password, fullName });
        setMode('login');
        setFullName('');
        setPassword('');
        setNotice(REGISTERED_NOTICE);
        return;
      }
      const me = await login(email, password);
      router.replace(landingFor(me, params.get('next')));
    } catch (err) {
      if (err instanceof NoWorkspaceError) {
        setPassword('');
        setNotice(NO_WORKSPACE_NOTICE);
      } else if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
        const next: Record<string, string> = {};
        for (const d of err.details as { path: string; message: string }[]) next[d.path] ??= d.message;
        setFieldErrors(next);
      } else {
        setError(err instanceof ApiError ? err.message : 'Unable to reach the server. Please try again.');
      }
    } finally {
      setPending(false);
    }
  };

  const isLogin = mode === 'login';

  return (
    <AuthCard
      title={isLogin ? 'Sign in' : 'Create your account'}
      subtitle={isLogin ? 'Welcome back — pick up where your team left off.' : 'Start tracking projects with your team in minutes.'}
      footer={
        <>
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="font-semibold text-primary-container hover:text-primary"
            onClick={() => {
              setMode(isLogin ? 'register' : 'login');
              setError(null);
              setNotice(null);
              setFieldErrors({});
            }}
          >
            {isLogin ? 'Create one' : 'Sign in'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-space-md" noValidate>
        {shownNotice && (
          <div role="status" className="flex items-start gap-2 rounded-lg bg-primary-fixed/50 p-space-sm text-body-sm text-on-primary-fixed-variant">
            <Icon name={shownNotice.icon} size={18} className="mt-px" />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">{shownNotice.title}</span>
              <span>{shownNotice.message}</span>
            </div>
          </div>
        )}
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-error-container p-space-sm text-body-sm text-on-error-container">
            <Icon name="error" size={18} className="mt-px" />
            <span>{error}</span>
          </div>
        )}
        {!isLogin && (
          <Field id={`${id}-name`} label="Full name" error={fieldErrors.fullName}>
            <Input id={`${id}-name`} autoComplete="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} inputSize="lg" />
          </Field>
        )}
        <Field id={`${id}-email`} label="Email" error={fieldErrors.email}>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            required
            autoFocus
            icon="mail"
            inputSize="lg"
            value={email}
            aria-invalid={!!fieldErrors.email || undefined}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </Field>
        <Field id={`${id}-password`} label="Password" error={fieldErrors.password} hint={!isLogin ? 'At least 8 characters with a letter and a number.' : undefined}>
          <Input
            id={`${id}-password`}
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            required
            icon="lock"
            inputSize="lg"
            value={password}
            aria-invalid={!!fieldErrors.password || undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={pending} className="mt-space-sm w-full">
          {isLogin ? 'Sign in' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <LoginForm />
    </Suspense>
  );
}
