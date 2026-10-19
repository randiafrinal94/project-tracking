'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Pill } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { TagChip } from '@/components/ui/tag-chip';
import type { TaskPatch, TaskPatchView } from '@/hooks/task';
import { cn } from '@/lib/cn';
import { daysFromToday, longDate } from '@/lib/format';
import type { Milestone, Tag, TaskDetail, WorkspaceMember } from '@/lib/types';

const TAG_COLORS = ['#4F46E5', '#2563EB', '#0EA5E9', '#059669', '#D97706', '#F97316', '#DC2626', '#64748B'];

function Label({ children }: { children: ReactNode }) {
  return <span className="text-label-sm font-semibold tracking-wider text-on-surface-variant uppercase">{children}</span>;
}

const ROW = 'flex items-center rounded-lg bg-surface-container-lowest p-2 shadow-xs';

function dueBadge(task: TaskDetail) {
  if (!task.dueDate || task.status === 'done') return null;
  const d = daysFromToday(task.dueDate);
  if (d < 0) return <Pill tone="danger" className="text-[11px] font-bold">{Math.abs(d)}d overdue</Pill>;
  if (d === 0) return <Pill tone="danger" className="text-[11px] font-bold">Due Today</Pill>;
  if (d <= 3) return <Pill tone="primary" className="text-[11px] font-bold">{d}d left</Pill>;
  return null;
}

export function MetaRail({
  task,
  editable,
  canAssign,
  members,
  milestones,
  tags,
  onPatch,
  onSetTags,
  onCreateTag,
}: {
  task: TaskDetail;
  editable: boolean;
  /** Mengubah assignee hanya untuk admin+ (member hanya mengerjakan task miliknya). */
  canAssign: boolean;
  members: WorkspaceMember[];
  milestones: Milestone[];
  tags: Tag[];
  onPatch: (patch: TaskPatch, view?: TaskPatchView) => void;
  onSetTags: (tagIds: string[], tags: TaskDetail['tags']) => void;
  onCreateTag: (name: string, color: string) => Promise<Tag>;
}) {
  const [logging, setLogging] = useState(false);
  const [logHours, setLogHours] = useState('');
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [estimateDraft, setEstimateDraft] = useState('');
  const [newTag, setNewTag] = useState('');

  const assignable = members.filter((m) => m.role !== 'viewer');
  const assigneeMember = members.find((m) => m.userId === task.assignee?.id);
  const milestone = milestones.find((m) => m.id === task.milestoneId);
  const estimate = task.estimateHours;
  const pct = estimate ? Math.round((task.actualHours / estimate) * 100) : 0;
  const over = estimate !== null && task.actualHours > estimate;

  const toggleTag = (tag: Pick<Tag, 'id' | 'name' | 'color'>) => {
    const has = task.tags.some((t) => t.id === tag.id);
    const next = has ? task.tags.filter((t) => t.id !== tag.id) : [...task.tags, tag].sort((a, b) => a.name.localeCompare(b.name));
    onSetTags(next.map((t) => t.id), next);
  };

  const submitLog = () => {
    const hours = Number(logHours);
    if (!Number.isFinite(hours) || hours <= 0) return;
    const total = Math.min(999.99, Math.round((task.actualHours + hours) * 100) / 100);
    onPatch({ actualHours: total });
    setLogHours('');
    setLogging(false);
  };

  const submitEstimate = () => {
    const value = estimateDraft.trim() === '' ? null : Number(estimateDraft);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 999.99)) return;
    onPatch({ estimateHours: value === null ? null : Math.round(value * 100) / 100 });
    setEditingEstimate(false);
  };

  return (
    <aside className="flex flex-col gap-space-lg border-surface-container bg-surface-container-low/70 p-space-lg lg:col-span-4 lg:border-l">
      {/* Assignee */}
      <div className="flex flex-col gap-space-xs">
        <Label>Assignee</Label>
        <div className="flex flex-col gap-2 pt-1">
          {task.assignee ? (
            <div className={cn(ROW, 'justify-between')}>
              <div className="flex items-center gap-2.5">
                <Avatar name={task.assignee.fullName} seed={task.assignee.id} src={task.assignee.avatarUrl} size="md" status="online" />
                <div className="flex flex-col">
                  <span className="text-label-md font-semibold leading-tight text-on-surface">{task.assignee.fullName}</span>
                  <span className="text-[11px] text-outline capitalize">{assigneeMember?.role ?? 'Member'}</span>
                </div>
              </div>
              {canAssign && (
                <button
                  type="button"
                  aria-label="Remove assignee"
                  onClick={() => onPatch({ assigneeId: null }, { assignee: null })}
                  className="text-outline-variant hover:text-on-surface"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
          ) : (
            <p className="text-body-sm text-on-surface-variant">Unassigned</p>
          )}
          {canAssign && (
            <Dropdown>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  className="flex w-fit items-center gap-1.5 rounded-lg px-2 py-1.5 text-label-sm text-primary transition-colors hover:bg-surface-container-highest"
                >
                  <Icon name="person_add" size={16} />
                  <span>{task.assignee ? 'Reassign' : 'Assign Teammate'}</span>
                </button>
              </DropdownTrigger>
              <DropdownContent className="w-[240px]">
                <DropdownLabel>Workspace members</DropdownLabel>
                {assignable.map((m) => (
                  <DropdownItem
                    key={m.userId}
                    active={m.userId === task.assignee?.id}
                    onSelect={() =>
                      onPatch({ assigneeId: m.userId }, { assignee: { id: m.userId, fullName: m.fullName, avatarUrl: m.avatarUrl } })
                    }
                  >
                    <span className="flex items-center gap-2">
                      <Avatar name={m.fullName} seed={m.userId} src={m.avatarUrl} size="sm" />
                      {m.fullName}
                    </span>
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          )}
        </div>
      </div>

      {/* Reporter */}
      <div className="flex flex-col gap-1">
        <Label>Reporter</Label>
        <div className={cn(ROW, 'gap-2.5')}>
          {task.reporter ? (
            <>
              <Avatar name={task.reporter.fullName} seed={task.reporter.id} src={task.reporter.avatarUrl} size="sm" />
              <span className="text-label-md font-medium text-on-surface">{task.reporter.fullName}</span>
            </>
          ) : (
            <span className="text-body-sm text-on-surface-variant">Unknown</span>
          )}
        </div>
      </div>

      {/* Start date (dipakai Gantt Timeline) */}
      <div className="flex flex-col gap-1">
        <Label>Start Date</Label>
        <div className={cn(ROW, 'gap-2')}>
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <Icon name="event" size={18} className="text-outline" />
            {editable ? (
              <input
                type="date"
                aria-label="Start date"
                value={task.startDate ?? ''}
                max={task.dueDate ?? undefined}
                onChange={(e) => onPatch({ startDate: e.target.value || null })}
                className="min-w-0 flex-1 bg-transparent text-label-md font-medium text-on-surface focus:outline-none"
              />
            ) : (
              <span className="text-label-md font-medium text-on-surface">{task.startDate ? longDate(task.startDate) : 'Not scheduled'}</span>
            )}
          </label>
        </div>
      </div>

      {/* Due date */}
      <div className="flex flex-col gap-1">
        <Label>Due Date</Label>
        <div className={cn(ROW, 'justify-between gap-2')}>
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <Icon name="calendar_today" size={18} className="text-outline" />
            {editable ? (
              <input
                type="date"
                aria-label="Due date"
                value={task.dueDate ?? ''}
                min={task.startDate ?? undefined}
                onChange={(e) => onPatch({ dueDate: e.target.value || null })}
                className="min-w-0 flex-1 bg-transparent text-label-md font-medium text-on-surface focus:outline-none"
              />
            ) : (
              <span className="text-label-md font-medium text-on-surface">{task.dueDate ? longDate(task.dueDate) : 'No due date'}</span>
            )}
          </label>
          {dueBadge(task)}
        </div>
      </div>

      {/* Time tracking */}
      <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest p-space-md shadow-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-label-sm font-semibold tracking-wider text-on-surface-variant uppercase">
            <Icon name="timer" size={16} className="text-primary" />
            Time Tracking
          </span>
          {estimate !== null && <span className={cn('tabular text-label-sm font-bold', over ? 'text-error' : 'text-on-surface')}>{pct}%</span>}
        </div>
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-surface-container">
          <div
            className={cn('h-full', over ? 'bg-error' : 'bg-primary-container')}
            style={{ width: `${estimate ? Math.min(100, pct) : task.actualHours > 0 ? 100 : 0}%` }}
            title={`${task.actualHours} hours logged`}
          />
        </div>
        <div className="flex items-center justify-between text-[12px] font-semibold tracking-[0.04em]">
          <span className="tabular font-medium text-on-surface">{task.actualHours}h logged</span>
          {editingEstimate ? (
            <input
              autoFocus
              type="number"
              min={0}
              max={999.99}
              step={0.25}
              aria-label="Estimated hours"
              value={estimateDraft}
              onChange={(e) => setEstimateDraft(e.target.value)}
              onBlur={submitEstimate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitEstimate();
                if (e.key === 'Escape') setEditingEstimate(false);
              }}
              className="w-20 rounded bg-surface-container-low px-1 text-right text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/20"
            />
          ) : (
            <button
              type="button"
              disabled={!editable}
              onClick={() => {
                setEstimateDraft(estimate === null ? '' : String(estimate));
                setEditingEstimate(true);
              }}
              className="tabular text-outline enabled:hover:text-primary"
              title={editable ? 'Edit estimate' : undefined}
            >
              {estimate === null ? 'Set estimate' : `${estimate}h estimated`}
            </button>
          )}
        </div>
        {editable &&
          (logging ? (
            <form
              className="mt-1 flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                submitLog();
              }}
            >
              <input
                autoFocus
                type="number"
                min={0.25}
                step={0.25}
                aria-label="Hours to log"
                placeholder="Hours"
                value={logHours}
                onChange={(e) => setLogHours(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setLogging(false)}
                className="h-8 min-w-0 flex-1 rounded-lg bg-surface-container-low px-2 text-body-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container/20"
              />
              <Button size="sm" variant="primary" type="submit" disabled={!(Number(logHours) > 0)}>
                Log
              </Button>
            </form>
          ) : (
            <Button variant="tonal" size="sm" icon="add" className="mt-1 w-full" onClick={() => setLogging(true)}>
              Log Time
            </Button>
          ))}
      </div>

      {/* Milestone */}
      <div className="flex flex-col gap-1">
        <Label>Milestone</Label>
        <Dropdown>
          <DropdownTrigger asChild disabled={!editable}>
            <button
              type="button"
              className={cn(ROW, 'gap-2 text-left transition-colors enabled:hover:bg-surface-container-high/40')}
            >
              <Icon name="flag" size={18} className={milestone ? 'text-tertiary-container' : 'text-outline'} />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-label-md font-semibold text-on-surface">{milestone?.name ?? task.milestone?.name ?? 'No milestone'}</span>
                {milestone && (
                  <span className="text-[11px] text-outline">
                    {milestone.dueDate ? `Target: ${longDate(milestone.dueDate)} • ` : ''}
                    {milestone.progress.percent}% overall
                  </span>
                )}
              </div>
            </button>
          </DropdownTrigger>
          <DropdownContent className="w-[260px]">
            <DropdownLabel>Milestone</DropdownLabel>
            {milestones.map((m) => (
              <DropdownItem
                key={m.id}
                icon="flag"
                active={m.id === task.milestoneId}
                onSelect={() => onPatch({ milestoneId: m.id }, { milestone: { id: m.id, name: m.name } })}
              >
                {m.name}
              </DropdownItem>
            ))}
            {milestones.length === 0 && <p className="px-space-sm py-1.5 text-body-sm text-on-surface-variant">No milestones in this project.</p>}
            {task.milestoneId && (
              <>
                <DropdownSeparator />
                <DropdownItem icon="close" onSelect={() => onPatch({ milestoneId: null }, { milestone: null })}>
                  Remove milestone
                </DropdownItem>
              </>
            )}
          </DropdownContent>
        </Dropdown>
      </div>

      {/* Tags */}
      <div className="flex flex-col gap-1.5">
        <Label>Tags</Label>
        <div className="flex flex-wrap gap-1.5">
          {task.tags.map((tag) => (
            <TagChip key={tag.id} name={tag.name} color={tag.color} shape="pill" />
          ))}
          {task.tags.length === 0 && !editable && <span className="text-body-sm text-on-surface-variant">No tags</span>}
          {editable && (
            <Dropdown>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-0.5 rounded-full border border-dashed border-outline-variant bg-surface-container-lowest px-2 py-0.5 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container"
                >
                  <Icon name="add" size={12} />
                  <span>Tag</span>
                </button>
              </DropdownTrigger>
              <DropdownContent className="max-h-[60vh] w-[240px] overflow-y-auto">
                <DropdownLabel>Tags</DropdownLabel>
                {tags.map((tag) => {
                  const checked = task.tags.some((t) => t.id === tag.id);
                  return (
                    <DropdownMenu.CheckboxItem
                      key={tag.id}
                      checked={checked}
                      onCheckedChange={() => toggleTag(tag)}
                      onSelect={(e) => e.preventDefault()}
                      className="flex cursor-pointer select-none items-center gap-space-sm rounded-md px-space-sm py-1.5 text-label-md text-on-surface outline-none data-[highlighted]:bg-primary-fixed/40"
                    >
                      <span className={cn('flex h-4 w-4 items-center justify-center rounded border', checked ? 'border-primary-container bg-primary-container text-on-primary' : 'border-[#cbd5e1]')}>
                        {checked && <Icon name="check" size={12} />}
                      </span>
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                      <span className="flex-1 truncate">{tag.name}</span>
                    </DropdownMenu.CheckboxItem>
                  );
                })}
                <DropdownSeparator />
                <form
                  className="flex items-center gap-1 p-1"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const name = newTag.trim();
                    if (!name) return;
                    const color = TAG_COLORS[tags.length % TAG_COLORS.length]!;
                    const created = await onCreateTag(name, color);
                    setNewTag('');
                    toggleTag(created);
                  }}
                >
                  <input
                    value={newTag}
                    maxLength={50}
                    aria-label="New tag name"
                    placeholder="Create tag…"
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.stopPropagation()}
                    className="h-8 min-w-0 flex-1 rounded-md bg-surface-container-low px-2 text-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container/20"
                  />
                  <Button size="sm" variant="primary" type="submit" disabled={!newTag.trim()} aria-label="Create tag" icon="add" />
                </form>
              </DropdownContent>
            </Dropdown>
          )}
        </div>
      </div>
    </aside>
  );
}
