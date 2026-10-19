'use client';

import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { AuthGate } from '@/components/layout/auth-gate';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/states';
import { useCurrentWorkspace } from '@/hooks/use-workspace';

function WorkspaceBoundary({ children }: { children: ReactNode }) {
  const workspace = useCurrentWorkspace();
  if (!workspace) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface">
        <EmptyState
          icon="travel_explore"
          title="Workspace not found"
          description="It may have been deleted, or you are not a member of it."
          action={
            <ButtonLink href="/" variant="primary">
              Go to my workspaces
            </ButtonLink>
          }
        />
      </main>
    );
  }
  return <AppShell>{children}</AppShell>;
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGate>
      <WorkspaceBoundary>{children}</WorkspaceBoundary>
    </AuthGate>
  );
}
