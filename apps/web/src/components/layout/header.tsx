'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { CreateProjectDialog } from '@/components/projects/create-project-dialog';
import { Avatar } from '@/components/ui/avatar';
import { Button, IconButton } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { Input } from '@/components/ui/input';
import { useProjects } from '@/hooks/queries';
import { useWorkspace } from '@/hooks/use-workspace';
import { useAuth, useMe } from '@/providers/auth-provider';
import { NotificationsBell } from './notifications-bell';

const SECTION_LABEL: Record<string, string> = {
  projects: 'Projects',
  tasks: 'Tasks',
  kanban: 'Kanban',
  milestones: 'Milestones',
  workload: 'Team Workload',
  reports: 'Reports',
  settings: 'Settings',
};

function useBreadcrumbs() {
  const workspace = useWorkspace();
  const pathname = usePathname();
  const projects = useProjects(workspace.id);
  const segments = pathname.split('/').filter(Boolean).slice(1);

  const crumbs: { label: string; href: string }[] = [{ label: workspace.name, href: `/${workspace.slug}` }];
  let href = `/${workspace.slug}`;
  for (const segment of segments) {
    href += `/${segment}`;
    const project = projects.data?.find((p) => p.id === segment);
    crumbs.push({ label: project?.name ?? SECTION_LABEL[segment] ?? segment, href });
  }
  if (segments.length === 0) crumbs.push({ label: 'Dashboard', href });
  return crumbs;
}

/** Header Stitch: `h-16 fixed bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]`. */
export function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const workspace = useWorkspace();
  const { user } = useMe();
  const { logout } = useAuth();
  const router = useRouter();
  const crumbs = useBreadcrumbs();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // ⌘K / Ctrl+K memfokuskan pencarian global.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-surface/80 shadow-chrome backdrop-blur-xl">
      <div className="flex h-16 w-full items-center justify-between gap-space-lg px-gutter md:px-gutter-lg">
        <div className="flex min-w-0 items-center gap-space-sm">
          <IconButton icon="menu" label="Open navigation" className="md:hidden" onClick={onOpenMenu} />
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-space-sm overflow-hidden text-body-sm text-on-surface-variant">
            {crumbs.map((crumb, i) => {
              const last = i === crumbs.length - 1;
              return (
                <Fragment key={crumb.href + i}>
                  {i > 0 && <span className="text-label-sm text-outline-variant">/</span>}
                  {last ? (
                    <span aria-current="page" className="truncate whitespace-nowrap text-label-md text-on-surface">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link
                      href={crumb.href}
                      className={`whitespace-nowrap transition-colors hover:text-on-surface ${i < crumbs.length - 2 ? 'hidden sm:inline' : ''}`}
                    >
                      {crumb.label}
                    </Link>
                  )}
                </Fragment>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-space-md">
          <form
            role="search"
            className="hidden w-72 lg:block"
            onSubmit={(e) => {
              e.preventDefault();
              const q = query.trim();
              router.push(`/${workspace.slug}/projects${q ? `?q=${encodeURIComponent(q)}` : ''}`);
            }}
          >
            <Input
              ref={searchRef}
              icon="search"
              shortcut="⌘K"
              type="search"
              aria-label="Search projects"
              placeholder="Search tasks, projects, docs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="[&_input]:shadow-none"
            />
          </form>

          {workspace.can('admin') ? (
            <Dropdown>
              <DropdownTrigger asChild>
                <Button variant="primary" icon="add">
                  New
                </Button>
              </DropdownTrigger>
              <DropdownContent align="end">
                <DropdownItem icon="create_new_folder" onSelect={() => setCreateOpen(true)}>
                  New project
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          ) : null}

          <NotificationsBell workspace={workspace} />
          <IconButton icon="help_outline" label="Help & Resources" className="hidden sm:flex" />

          <Dropdown>
            <DropdownTrigger asChild>
              <button
                type="button"
                aria-label="Account menu"
                className="relative flex items-center rounded-full pl-space-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/35"
              >
                <Avatar name={user.fullName} seed={user.id} src={user.avatarUrl} size="lg" status="online" />
              </button>
            </DropdownTrigger>
            <DropdownContent align="end" className="w-[240px]">
              <div className="px-space-sm py-1.5">
                <p className="truncate text-label-md font-semibold text-on-surface">{user.fullName}</p>
                <p className="truncate text-body-sm text-on-surface-variant">{user.email}</p>
              </div>
              <DropdownSeparator />
              <DropdownLabel>{workspace.name}</DropdownLabel>
              <div className="px-space-sm pb-1.5 text-body-sm text-on-surface-variant capitalize">Role: {workspace.role}</div>
              <DropdownSeparator />
              <DropdownItem icon="logout" destructive onSelect={() => void logout()}>
                Sign out
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>
      <CreateProjectDialog workspace={workspace} open={createOpen} onOpenChange={setCreateOpen} />
    </header>
  );
}
