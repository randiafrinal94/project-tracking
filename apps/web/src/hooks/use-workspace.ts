'use client';

import { useParams } from 'next/navigation';
import { useMe } from '@/providers/auth-provider';
import type { MemberRole, WorkspaceRef } from '@/lib/types';

const RANK: Record<MemberRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

export const canRole = (role: MemberRole, min: MemberRole) => RANK[role] >= RANK[min];

/** Workspace aktif dari segmen URL `/[workspace]` (slug). `null` bila slug tidak dikenal. */
export function useCurrentWorkspace(): WorkspaceRef | null {
  const params = useParams<{ workspace?: string }>();
  const { workspaces } = useMe();
  return workspaces.find((w) => w.slug === params.workspace) ?? null;
}

/** Versi yang mewajibkan workspace ada (dipakai di dalam layout workspace). */
export function useWorkspace(): WorkspaceRef & { can: (min: MemberRole) => boolean } {
  const workspace = useCurrentWorkspace();
  if (!workspace) throw new Error('useWorkspace must be used under a valid /[workspace] route');
  return { ...workspace, can: (min) => canRole(workspace.role, min) };
}
