'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/layout/auth-card';
import { FullScreenLoader } from '@/components/layout/auth-gate';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Field, Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api';
import type { Me } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

/** Hanya izinkan redirect internal (mencegah open redirect lewat ?next=). */
const safeNext = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : null);

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (state.status === 'authenticated') router.replace(landingFor(state.me, params.get('next')));
  }, [state, router, params]);

  if (state.status !== 'unauthenticated') return <FullScreenLoader />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);
    try {
      const me = mode === 'login' ? await login(email, password) : await register({ email, password, fullName });
      router.replace(landingFor(me, params.get('next')));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
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
              setFieldErrors({});
            }}
          >
            {isLogin ? 'Create one' : 'Sign in'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-space-md" noValidate>
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
      <p className="mt-space-lg text-center text-body-sm text-outline">
        <Link href="/design-system" className="hover:text-on-surface">
          View design system
        </Link>
      </p>
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
