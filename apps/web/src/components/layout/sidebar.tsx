'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CountBadge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { useProjects } from '@/hooks/queries';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/cn';
import { WorkspaceSwitcher } from './workspace-switcher';

interface NavItem {
  label: string;
  icon: string;
  href: string;
  /** Aktif bila pathname sama persis (Dashboard) atau berawalan href. */
  exact?: boolean;
  count?: number;
  children?: { label: string; href: string }[];
}

/**
 * Sidebar Stitch: `w-64 bg-surface-container-low shadow-[0_1px_8px_rgba(0,0,0,0.04)]`.
 * `variant="rail"` menampilkan ikon saja (tablet / collapsed), `variant="full"` lengkap.
 */
export function Sidebar({ variant, onNavigate }: { variant: 'full' | 'rail'; onNavigate?: () => void }) {
  const workspace = useWorkspace();
  const pathname = usePathname();
  const projects = useProjects(workspace.id);
  const base = `/${workspace.slug}`;
  const rail = variant === 'rail';

  const items: NavItem[] = [
    { label: 'Dashboard', icon: 'grid_view', href: base, exact: true },
    { label: 'Projects', icon: 'folder_open', href: `${base}/projects`, count: projects.data?.length },
    {
      label: 'Tasks',
      icon: 'check_box',
      href: `${base}/tasks`,
      children: [
        { label: 'Kanban', href: `${base}/tasks/kanban` },
        { label: 'List', href: `${base}/tasks` },
      ],
    },
    { label: 'Milestones', icon: 'flag', href: `${base}/milestones` },
    { label: 'Team Workload', icon: 'group', href: `${base}/workload` },
    { label: 'Reports', icon: 'bar_chart', href: `${base}/reports` },
  ];

  const isActive = (item: { href: string; exact?: boolean }) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <div className="flex h-full flex-col justify-between overflow-y-auto no-scrollbar">
      <div className="flex flex-col">
        {/* Brand */}
        <div className={cn('flex items-center pb-space-md pt-space-lg', rail ? 'justify-center px-0' : 'px-gutter')}>
          <Link href={base} onClick={onNavigate} className="flex items-center gap-space-sm" aria-label="Project Tracker home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-container text-on-primary shadow-xs">
              <Icon name="deployed_code" size={20} />
            </span>
            {!rail && (
              <span className="text-headline-md tracking-tight text-on-surface">Project Tracker</span>
            )}
          </Link>
        </div>

        <div className={cn('pb-space-md', rail ? 'px-space-sm' : 'px-gutter')}>
          <WorkspaceSwitcher current={workspace} compact={rail} />
        </div>

        <nav aria-label="Main" className={cn('flex flex-col gap-space-xs', rail ? 'px-space-sm' : 'px-gutter')}>
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item)} rail={rail} pathname={pathname} onNavigate={onNavigate} />
          ))}
          <div className="mt-space-md pt-space-md">
            <NavLink
              item={{ label: 'Settings', icon: 'settings', href: `${base}/settings` }}
              active={isActive({ href: `${base}/settings` })}
              rail={rail}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          </div>
        </nav>
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  rail,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  rail: boolean;
  pathname: string;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const hasChildren = !!item.children?.length && !rail;
  // Item induk berstatus aktif hanya bila tidak ada sub-item yang cocok persis.
  const childActive = item.children?.some((c) => c.href === pathname) ?? false;
  const highlight = active && !childActive;

  const linkClass = cn(
    'flex items-center rounded-lg py-space-sm transition-colors',
    rail ? 'justify-center px-0' : 'justify-between px-space-md',
    highlight
      ? 'bg-primary-container font-medium text-on-primary'
      : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
  );

  return (
    <div className="flex flex-col">
      <div className="relative flex items-center">
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={highlight ? 'page' : undefined}
          title={rail ? item.label : undefined}
          className={cn(linkClass, 'flex-1')}
        >
          <span className="flex items-center gap-space-md">
            <Icon name={item.icon} size={20} />
            {!rail && <span className="text-label-md">{item.label}</span>}
          </span>
          {!rail && item.count !== undefined && (
            <CountBadge
              value={item.count}
              className={cn(
                'px-space-sm py-0.5 text-label-sm',
                highlight ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-high text-on-surface-variant',
              )}
            />
          )}
          {hasChildren && <span className="w-4" />}
        </Link>
        {hasChildren && (
          <button
            type="button"
            aria-label={`${open ? 'Collapse' : 'Expand'} ${item.label}`}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={cn(
              'absolute right-space-md rounded transition-transform',
              highlight ? 'text-on-primary' : 'text-on-surface-variant',
              !open && '-rotate-90',
            )}
          >
            <Icon name="expand_more" size={16} />
          </button>
        )}
      </div>

      {hasChildren && open && (
        <div className="flex flex-col gap-space-xs pl-space-xl pt-1">
          {item.children!.map((child) => {
            const current = child.href === pathname;
            return (
              <Link
                key={child.href}
                href={child.href}
                onClick={onNavigate}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-space-sm rounded-lg px-space-sm py-1.5 text-body-sm transition-colors',
                  current
                    ? 'bg-surface-container font-medium text-on-surface'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', current ? 'bg-primary-container' : 'bg-outline-variant')} />
                <span>{child.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
