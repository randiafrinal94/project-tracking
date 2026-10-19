'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { priorityLabel } from '@/components/ui/badge';
import { Dropdown, DropdownContent, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';
import type { Milestone, Tag, TaskFilters, TaskPriority, WorkspaceMember } from '@/lib/types';

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

const toggle = <T,>(list: T[] | undefined, value: T) =>
  list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value];

function CheckItem({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <DropdownMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onToggle}
      onSelect={(e) => e.preventDefault()}
      className="flex cursor-pointer select-none items-center gap-space-sm rounded-md px-space-sm py-1.5 text-label-md text-on-surface outline-none data-[highlighted]:bg-primary-fixed/40"
    >
      <span
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded border',
          checked ? 'border-primary-container bg-primary-container text-on-primary' : 'border-[#cbd5e1] bg-surface-container-lowest',
        )}
      >
        {checked && <Icon name="check" size={12} />}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">{children}</span>
    </DropdownMenu.CheckboxItem>
  );
}

/** Quick filter bar Stitch: search · avatar assignee · chip tag · "Add Filter". */
export function BoardFilters({
  filters,
  onChange,
  members,
  tags,
  milestones,
  currentUserId,
}: {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  members: WorkspaceMember[];
  tags: Tag[];
  milestones: Milestone[];
  currentUserId: string;
}) {
  const [q, setQ] = useState(filters.q ?? '');

  // Debounce pencarian agar tidak memanggil API setiap ketikan.
  useEffect(() => {
    const id = setTimeout(() => {
      const value = q.trim() || undefined;
      if (value !== filters.q) onChange({ ...filters, q: value });
    }, 300);
    return () => clearTimeout(id);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const assignable = members.filter((m) => m.role !== 'viewer');
  const shownMembers = assignable.slice(0, 4);
  const topTags = [...tags].sort((a, b) => b.usageCount - a.usageCount).slice(0, 4);
  const extraCount =
    (filters.priority?.length ?? 0) + (filters.milestoneId ? 1 : 0) + (filters.overdue ? 1 : 0) +
    (filters.assigneeId === 'unassigned' ? 1 : 0) +
    (filters.tagId?.filter((id) => !topTags.some((t) => t.id === id)).length ?? 0);
  const anyActive =
    !!filters.q || !!filters.assigneeId || !!filters.priority?.length || !!filters.tagId?.length || !!filters.milestoneId || !!filters.overdue;

  return (
    <div className="flex flex-1 flex-wrap items-center gap-space-sm lg:justify-end">
      <Input
        icon="search"
        inputSize="sm"
        type="search"
        aria-label="Filter tasks"
        placeholder="Filter tasks..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full sm:w-56"
      />

      <div className="flex items-center -space-x-1 pl-1" role="group" aria-label="Filter by assignee">
        {shownMembers.map((m) => {
          const active = filters.assigneeId === m.userId;
          return (
            <button
              key={m.userId}
              type="button"
              aria-pressed={active}
              title={`${m.fullName}${m.userId === currentUserId ? ' (you)' : ''}`}
              onClick={() => onChange({ ...filters, assigneeId: active ? undefined : m.userId })}
              className={cn(
                'relative rounded-full transition-transform hover:z-10 hover:-translate-y-0.5',
                active && 'z-10 ring-2 ring-primary-container ring-offset-1',
                filters.assigneeId && !active && 'opacity-50',
              )}
            >
              <Avatar name={m.fullName} seed={m.userId} src={m.avatarUrl} size="md" ring />
            </button>
          );
        })}
        {assignable.length > shownMembers.length && (
          <Dropdown>
            <DropdownTrigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-container-high text-[11px] font-medium text-on-surface-variant ring-2 ring-surface hover:bg-surface-container-highest"
              >
                +{assignable.length - shownMembers.length}
              </button>
            </DropdownTrigger>
            <DropdownContent align="end">
              <DropdownLabel>Assignee</DropdownLabel>
              {assignable.slice(shownMembers.length).map((m) => (
                <CheckItem
                  key={m.userId}
                  checked={filters.assigneeId === m.userId}
                  onToggle={() => onChange({ ...filters, assigneeId: filters.assigneeId === m.userId ? undefined : m.userId })}
                >
                  <Avatar name={m.fullName} seed={m.userId} size="sm" /> {m.fullName}
                </CheckItem>
              ))}
            </DropdownContent>
          </Dropdown>
        )}
      </div>

      {topTags.length > 0 && <div className="hidden h-4 w-px bg-outline-variant sm:block" />}

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by tag">
        {topTags.map((tag) => {
          const active = filters.tagId?.includes(tag.id) ?? false;
          const isBug = tag.name.toLowerCase() === 'bug';
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange({ ...filters, tagId: toggle(filters.tagId, tag.id) })}
              className={cn(
                'flex items-center gap-1 rounded-full px-2.5 py-1 text-label-sm transition-colors',
                active
                  ? isBug
                    ? 'bg-error-container text-on-error-container'
                    : 'bg-primary-fixed/60 text-on-primary-fixed-variant hover:bg-primary-fixed'
                  : 'bg-surface-container-lowest text-on-surface-variant shadow-xs hover:bg-surface-container',
              )}
            >
              {isBug && <span className="h-1.5 w-1.5 rounded-full bg-error" />}
              {tag.name}
              {tag.usageCount > 0 && isBug && ` (${tag.usageCount})`}
            </button>
          );
        })}
      </div>

      <Dropdown>
        <DropdownTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-label-sm text-primary transition-colors hover:text-on-primary-fixed-variant"
          >
            <Icon name="add_circle" size={16} />
            <span>Add Filter</span>
            {extraCount > 0 && <span className="rounded-full bg-primary-fixed px-1.5 text-[10px] text-on-primary-fixed">{extraCount}</span>}
          </button>
        </DropdownTrigger>
        <DropdownContent align="end" className="max-h-[70vh] w-[260px] overflow-y-auto">
          <DropdownLabel>Priority</DropdownLabel>
          {PRIORITIES.map((p) => (
            <CheckItem key={p} checked={filters.priority?.includes(p) ?? false} onToggle={() => onChange({ ...filters, priority: toggle(filters.priority, p) })}>
              {priorityLabel(p)}
            </CheckItem>
          ))}
          <DropdownSeparator />
          <DropdownLabel>Quick filters</DropdownLabel>
          <CheckItem checked={!!filters.overdue} onToggle={() => onChange({ ...filters, overdue: filters.overdue ? undefined : true })}>
            <Icon name="alarm" size={16} className="text-error" /> Overdue only
          </CheckItem>
          <CheckItem checked={filters.assigneeId === currentUserId} onToggle={() => onChange({ ...filters, assigneeId: filters.assigneeId === currentUserId ? undefined : currentUserId })}>
            <Icon name="person" size={16} /> Assigned to me
          </CheckItem>
          <CheckItem checked={filters.assigneeId === 'unassigned'} onToggle={() => onChange({ ...filters, assigneeId: filters.assigneeId === 'unassigned' ? undefined : 'unassigned' })}>
            <Icon name="person_off" size={16} /> Unassigned
          </CheckItem>
          {milestones.length > 0 && (
            <>
              <DropdownSeparator />
              <DropdownLabel>Milestone</DropdownLabel>
              {milestones.map((m) => (
                <CheckItem key={m.id} checked={filters.milestoneId === m.id} onToggle={() => onChange({ ...filters, milestoneId: filters.milestoneId === m.id ? undefined : m.id })}>
                  <Icon name="flag" size={16} className="text-tertiary-container" /> {m.name}
                </CheckItem>
              ))}
              <CheckItem checked={filters.milestoneId === 'none'} onToggle={() => onChange({ ...filters, milestoneId: filters.milestoneId === 'none' ? undefined : 'none' })}>
                No milestone
              </CheckItem>
            </>
          )}
          {tags.length > topTags.length && (
            <>
              <DropdownSeparator />
              <DropdownLabel>More tags</DropdownLabel>
              {tags.filter((t) => !topTags.some((x) => x.id === t.id)).map((t) => (
                <CheckItem key={t.id} checked={filters.tagId?.includes(t.id) ?? false} onToggle={() => onChange({ ...filters, tagId: toggle(filters.tagId, t.id) })}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} /> {t.name}
                </CheckItem>
              ))}
            </>
          )}
        </DropdownContent>
      </Dropdown>

      {anyActive && (
        <button
          type="button"
          onClick={() => {
            setQ('');
            onChange({});
          }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-label-sm text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
        >
          <Icon name="close" size={14} /> Clear
        </button>
      )}
    </div>
  );
}
