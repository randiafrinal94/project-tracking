'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { CountBadge, TASK_STATUS } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { cn } from '@/lib/cn';
import type { TaskCard as Task, TaskStatus } from '@/lib/types';
import { TaskCard } from './task-card';
import { VIRTUALIZE_AT, WindowVirtualList } from './virtual-list';

export const columnId = (status: TaskStatus) => `column:${status}`;

function SortableTaskCard({
  task,
  disabled,
  onOpen,
  onPrefetch,
}: {
  task: Task;
  disabled: boolean;
  onOpen: (id: string) => void;
  onPrefetch?: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
    disabled,
  });
  // dnd-kit menandai kartu read-only sebagai aria-disabled, padahal kartu tetap bisa dibuka.
  const { 'aria-disabled': _ariaDisabled, ...a11y } = attributes;

  return (
    <TaskCard
      ref={setNodeRef}
      task={task}
      ghost={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...a11y}
      {...listeners}
      // Klik membuka detail; drag dimulai setelah pointer bergerak ≥6px (activation constraint).
      onClick={() => onOpen(task.id)}
      onPointerEnter={() => onPrefetch?.(task.id)}
      onFocus={() => onPrefetch?.(task.id)}
      onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
        listeners?.onKeyDown?.(e);
        if (e.key === 'Enter' && !e.defaultPrevented) onOpen(task.id);
      }}
      tabIndex={0}
      role="button"
      aria-roledescription={disabled ? undefined : 'draggable task'}
    />
  );
}

interface BoardColumnProps {
  status: TaskStatus;
  tasks: Task[];
  total: number;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  canEdit: boolean;
  filtered: boolean;
  onOpenTask: (id: string) => void;
  onPrefetchTask?: (id: string) => void;
  onQuickAdd: (status: TaskStatus, title: string) => Promise<unknown>;
}

/** Kolom Kanban Stitch: `rounded-xl bg-surface-container-low p-space-md`, bar status 4px di atas. */
export function BoardColumn({
  status,
  tasks,
  total,
  loading,
  error,
  onRetry,
  hasMore,
  loadingMore,
  onLoadMore,
  canEdit,
  filtered,
  onOpenTask,
  onPrefetchTask,
  onQuickAdd,
}: BoardColumnProps) {
  const meta = TASK_STATUS[status];
  const { setNodeRef, isOver } = useDroppable({ id: columnId(status), data: { status } });
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const estimate = tasks.reduce((sum, t) => sum + (t.estimateHours ?? 0), 0);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    setSaving(true);
    try {
      await onQuickAdd(status, value);
      setTitle('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label={`${meta.label} column`}
      className={cn(
        'relative flex min-w-0 flex-col rounded-xl bg-surface-container-low p-space-md shadow-xs transition-colors',
        isOver && 'bg-surface-container',
      )}
    >
      {meta.bar && <div className={cn('absolute left-0 right-0 top-0 h-1 rounded-t-xl', meta.bar)} />}

      <div className={cn('mb-space-md flex items-center justify-between pb-space-xs', meta.bar && 'pt-1')}>
        <div className="flex items-center gap-2">
          <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
          <h3 className="text-label-md font-semibold text-on-surface">{meta.label}</h3>
          <CountBadge value={total} className={cn('px-1.5', meta.count)} />
        </div>
        <div className="flex items-center gap-1 text-on-surface-variant">
          {estimate > 0 && <span className="tabular font-mono text-[11px] text-outline">{Math.round(estimate * 10) / 10}h</span>}
          {canEdit && (
            <Dropdown>
              <DropdownTrigger asChild>
                <button
                  type="button"
                  aria-label={`${meta.label} column options`}
                  className="rounded p-0.5 text-outline-variant hover:bg-surface-container hover:text-on-surface"
                >
                  <Icon name="more_horiz" size={18} />
                </button>
              </DropdownTrigger>
              <DropdownContent align="end">
                <DropdownItem icon="add" onSelect={() => setAdding(true)}>
                  Add task to {meta.label}
                </DropdownItem>
              </DropdownContent>
            </Dropdown>
          )}
        </div>
      </div>

      {canEdit && (status === 'backlog' || adding) && (
        adding ? (
          <form onSubmit={submit} className="mb-space-md rounded-lg bg-surface-container-lowest p-2 shadow-xs">
            <input
              autoFocus
              value={title}
              maxLength={255}
              disabled={saving}
              aria-label={`New task title in ${meta.label}`}
              placeholder="Task title, then press Enter"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setAdding(false);
                  setTitle('');
                }
              }}
              className="w-full bg-transparent px-1 py-1 text-body-sm text-on-surface placeholder:text-outline focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => { setAdding(false); setTitle(''); }}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" type="submit" loading={saving} disabled={!title.trim()}>
                Add
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mb-space-md flex w-full items-center justify-center gap-1.5 rounded-lg bg-surface-container-lowest/80 px-space-md py-2 text-label-md text-on-surface-variant transition-all hover:bg-surface-container-lowest hover:text-primary hover:shadow-xs"
          >
            <Icon name="add" size={18} />
            <span>Quick task</span>
          </button>
        )
      )}

      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-space-md">
        {loading ? (
          Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-28 w-full bg-surface-container-lowest" />)
        ) : error ? (
          <ErrorState compact error={error} onRetry={onRetry} title="Column failed to load" />
        ) : (
          <SortableContext id={columnId(status)} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.length > VIRTUALIZE_AT ? (
              // Kolom besar (>200 task): hanya kartu di sekitar viewport yang dirender.
              <WindowVirtualList
                items={tasks}
                getKey={(t) => t.id}
                estimateSize={168}
                hasMore={hasMore}
                loadingMore={loadingMore}
                onLoadMore={onLoadMore}
                render={(task) => (
                  <SortableTaskCard task={task} disabled={!canEdit} onOpen={onOpenTask} onPrefetch={onPrefetchTask} />
                )}
              />
            ) : (
              tasks.map((task) => (
                <SortableTaskCard key={task.id} task={task} disabled={!canEdit} onOpen={onOpenTask} onPrefetch={onPrefetchTask} />
              ))
            )}
            {tasks.length === 0 && (
              <div
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-outline-variant/70 px-space-md py-space-lg text-center',
                  isOver && 'border-primary-container bg-primary-fixed/30',
                )}
              >
                <Icon name={filtered ? 'filter_alt_off' : 'inbox'} size={20} className="text-outline" />
                <p className="text-body-sm text-on-surface-variant">
                  {filtered ? 'No tasks match the filters' : canEdit ? 'Drop tasks here' : 'No tasks'}
                </p>
              </div>
            )}
          </SortableContext>
        )}
        {hasMore && !loading && tasks.length <= VIRTUALIZE_AT && (
          <Button variant="tonal" size="sm" onClick={onLoadMore} loading={loadingMore} className="w-full">
            {loadingMore ? 'Loading…' : `Load more (${total - tasks.length} left)`}
          </Button>
        )}
        {tasks.length > VIRTUALIZE_AT && (
          <p className="tabular text-center text-[11px] text-outline" aria-live="polite">
            {tasks.length} of {total} loaded
          </p>
        )}
      </div>
      {saving && <Spinner className="absolute right-3 top-3 text-primary-container" size={12} />}
    </section>
  );
}
