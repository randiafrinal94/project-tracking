'use client';

import Link from 'next/link';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/cn';
import type { WorkspaceRef } from '@/lib/types';
import { useMe } from '@/providers/auth-provider';

/** Tombol workspace di atas nav: inisial · nama workspace · ⇕. */
export function WorkspaceSwitcher({ current, compact }: { current: WorkspaceRef; compact?: boolean }) {
  const { user, workspaces } = useMe();

  return (
    <Dropdown>
      <DropdownTrigger asChild>
        <button
          type="button"
          aria-label={`Workspace: ${current.name}. Switch workspace`}
          className={cn(
            'flex w-full items-center justify-between rounded-lg bg-surface-container-lowest py-space-sm shadow-level-1 transition-colors hover:bg-surface-container',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/35',
            compact ? 'justify-center px-0' : 'px-space-md',
          )}
        >
          <div className="flex items-center gap-space-sm overflow-hidden">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary-container text-label-sm text-on-primary">
              {current.name.charAt(0).toUpperCase()}
            </span>
            {!compact && <span className="truncate text-label-md text-on-surface">{current.name}</span>}
          </div>
          {!compact && <Icon name="unfold_more" size={18} className="text-on-surface-variant" />}
        </button>
      </DropdownTrigger>
      <DropdownContent className="w-[240px]">
        <DropdownLabel>Workspaces</DropdownLabel>
        {workspaces.map((w) => (
          <DropdownItem key={w.id} asChild active={w.id === current.id}>
            <Link href={`/${w.slug}`}>
              <span className="flex h-5 w-5 items-center justify-center rounded bg-primary-container text-label-sm text-on-primary">
                {w.name.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1 truncate">{w.name}</span>
              <span className="text-[11px] text-outline capitalize">{w.role}</span>
            </Link>
          </DropdownItem>
        ))}
        {user.canCreateWorkspace && (
          <>
            <DropdownSeparator />
            <DropdownItem asChild icon="add">
              <Link href="/onboarding">Create workspace</Link>
            </DropdownItem>
          </>
        )}
      </DropdownContent>
    </Dropdown>
  );
}
