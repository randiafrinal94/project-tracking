'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { AuthCard } from '@/components/layout/auth-card';
import { AuthGate } from '@/components/layout/auth-gate';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import type { Workspace } from '@/lib/types';
import { useAuth } from '@/providers/auth-provider';

function CreateWorkspace() {
  const id = useId();
  const router = useRouter();
  const { state, reloadMe, logout } = useAuth();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const hasWorkspaces = state.status === 'authenticated' && state.me.workspaces.length > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const workspace = await api<Workspace>('/workspaces', { method: 'POST', body: { name } });
      await reloadMe();
      router.replace(`/${workspace.slug}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to create the workspace.');
      setPending(false);
    }
  };

  return (
    <AuthCard
      title="Create a workspace"
      subtitle="Workspaces hold your team's projects, members and boards. You'll be its owner."
      footer={
        hasWorkspaces ? (
          <Link href="/" className="font-semibold text-primary-container hover:text-primary">
            Back to my workspaces
          </Link>
        ) : (
          <button type="button" onClick={() => void logout()} className="hover:text-on-surface">
            Sign out
          </button>
        )
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-space-md" noValidate>
        <Field id={`${id}-name`} label="Workspace name" error={error ?? undefined} hint="e.g. your team or company name.">
          <Input
            id={`${id}-name`}
            required
            autoFocus
            inputSize="lg"
            maxLength={150}
            value={name}
            aria-invalid={!!error || undefined}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Corp"
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!name.trim()} className="w-full">
          Create workspace
        </Button>
      </form>
    </AuthCard>
  );
}

export default function OnboardingPage() {
  return (
    <AuthGate>
      <CreateWorkspace />
    </AuthGate>
  );
}
