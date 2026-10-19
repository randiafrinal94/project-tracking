'use client';

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core';
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useState } from 'react';
import { TaskCard } from '@/components/board/task-card';
import { WindowVirtualList, VIRTUALIZE_AT } from '@/components/board/virtual-list';
import { CountBadge, TASK_STATUS } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { STATUSES } from '@/hooks/board';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { MoveResult, Page, TaskCard as Task, TaskFilters, TaskStatus } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';

type ColumnData = InfiniteData<Page<Task>, unknown>;

const columnKey = (workspaceId: string, status: TaskStatus, filters: TaskFilters) =>
  ['workspace', workspaceId, 'tasks', 'board', status, filters] as const;

function useColumn(workspaceId: string, status: TaskStatus, filters: TaskFilters) {
  return useInfiniteQuery({
    queryKey: columnKey(workspaceId, status, filters),
    queryFn: ({ pageParam, signal }) =>
      api<Page<Task>>(`/workspaces/${workspaceId}/tasks`, {
        query: {
          status, projectId: filters.projectId, q: filters.q, assigneeId: filters.assigneeId,
          priority: filters.priority?.length ? filters.priority : undefined,
          overdue: filters.overdue || undefined, cursor: (pageParam as string | null) ?? undefined, limit: 50,
        },
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Keyboard: ←/→ pindah ke kolom status sebelah. */
const keyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (event.code !== 'ArrowRight' && event.code !== 'ArrowLeft') return undefined;
  event.preventDefault();
  const from = String(context.over?.id ?? context.active?.data.current?.status ?? '');
  const status = (from.startsWith('xcol:') ? from.slice(5) : from) as TaskStatus;
  const target = STATUSES[STATUSES.indexOf(status) + (event.code === 'ArrowRight' ? 1 : -1)];
  const rect = target ? context.droppableRects.get(`xcol:${target}`) : undefined;
  return rect ? { x: rect.left + 8, y: rect.top + 8 } : undefined;
};

const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  return hits.length ? hits : rectIntersection(args);
};

function DraggableCard({ task, canEdit, onOpen }: { task: Task; canEdit: boolean; onOpen: (t: Task) => void }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: task.id, data: { status: task.status, task }, disabled: !canEdit });
  const { 'aria-disabled': _x, ...a11y } = attributes;
  return (
    <TaskCard
      ref={setNodeRef}
      task={task}
      ghost={isDragging}
      {...a11y}
      {...listeners}
      tabIndex={0}
      role="button"
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e);
        if (e.key === 'Enter' && !e.defaultPrevented) onOpen(task);
      }}
    />
  );
}

function Column({ status, workspaceId, filters, canEdit, onOpen }: { status: TaskStatus; workspaceId: string; filters: TaskFilters; canEdit: boolean; onOpen: (t: Task) => void }) {
  const q = useColumn(workspaceId, status, filters);
  const { setNodeRef, isOver } = useDroppable({ id: `xcol:${status}` });
  const meta = TASK_STATUS[status];
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  const card = (t: Task) => <DraggableCard task={t} canEdit={canEdit} onOpen={onOpen} />;

  return (
    <section aria-label={`${meta.label} column`} className={cn('relative flex min-w-0 flex-col rounded-xl bg-surface-container-low p-space-md shadow-xs', isOver && 'bg-surface-container')}>
      {meta.bar && <div className={cn('absolute left-0 right-0 top-0 h-1 rounded-t-xl', meta.bar)} />}
      <div className={cn('mb-space-md flex items-center gap-2 pb-space-xs', meta.bar && 'pt-1')}>
        <span className={cn('h-2.5 w-2.5 rounded-full', meta.dot)} />
        <h3 className="text-label-md font-semibold text-on-surface">{meta.label}</h3>
        <CountBadge value={total} className={cn('px-1.5', meta.count)} />
      </div>
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-space-md">
        {q.isLoading ? (
          Array.from({ length: 2 }, (_, i) => <Skeleton key={i} className="h-28 w-full bg-surface-container-lowest" />)
        ) : q.isError ? (
          <ErrorState compact error={q.error} onRetry={() => q.refetch()} />
        ) : items.length === 0 ? (
          <div className={cn('flex flex-1 items-center justify-center rounded-lg border border-dashed border-outline-variant/70 px-space-md py-space-lg text-body-sm text-on-surface-variant', isOver && 'border-primary-container bg-primary-fixed/30')}>
            {canEdit ? 'Drop tasks here' : 'No tasks'}
          </div>
        ) : items.length > VIRTUALIZE_AT ? (
          <WindowVirtualList items={items} getKey={(t) => t.id} estimateSize={168} hasMore={!!q.hasNextPage} loadingMore={q.isFetchingNextPage} onLoadMore={() => void q.fetchNextPage()} render={card} />
        ) : (
          items.map((t) => <div key={t.id}>{card(t)}</div>)
        )}
      </div>
    </section>
  );
}

/** Board lintas project (status saja). Drag mengubah status; urutan mengikuti tiap project. */
export function CrossProjectBoard({ workspaceId, filters, canEdit, onOpen }: { workspaceId: string; filters: TaskFilters; canEdit: boolean; onOpen: (t: Task) => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [active, setActive] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates }),
  );

  const move = useMutation({
    mutationFn: ({ task, to }: { task: Task; to: TaskStatus; snapshot: [readonly unknown[], ColumnData | undefined][] }) =>
      api<MoveResult>(`/tasks/${task.id}/move`, { method: 'PATCH', body: { status: to } }),
    onSuccess: (_r, v) => {
      queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId, 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project', v.task.projectId] });
      toast({ tone: 'success', title: `${v.task.key} → ${TASK_STATUS[v.to].label}` });
    },
    onError: (e, v) => {
      for (const [key, data] of v.snapshot) queryClient.setQueryData(key, data);
      toast({ tone: 'error', title: 'Could not move task', description: `${(e as Error).message}. The card was returned.` });
    },
  });

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null);
    const task = a.data.current?.task as Task | undefined;
    const to = over ? (String(over.id).slice(5) as TaskStatus) : undefined;
    if (!task || !to || to === task.status) return;

    const fromKey = columnKey(workspaceId, task.status, filters);
    const toKey = columnKey(workspaceId, to, filters);
    const snapshot: [readonly unknown[], ColumnData | undefined][] = [
      [fromKey, queryClient.getQueryData<ColumnData>(fromKey)],
      [toKey, queryClient.getQueryData<ColumnData>(toKey)],
    ];
    const moved: Task = { ...task, status: to, completedAt: to === 'done' ? new Date().toISOString() : null };
    queryClient.setQueryData<ColumnData>(fromKey, (d) =>
      d && { ...d, pages: d.pages.map((p, i) => ({ ...p, items: p.items.filter((t) => t.id !== task.id), total: i === 0 ? Math.max(0, (p.total ?? 1) - 1) : p.total })) },
    );
    queryClient.setQueryData<ColumnData>(toKey, (d) =>
      d && { ...d, pages: d.pages.map((p, i) => (i === 0 ? { ...p, items: [moved, ...p.items], total: (p.total ?? 0) + 1 } : p)) },
    );
    move.mutate({ task, to, snapshot });
  };

  return (
    <DndContext
      sensors={canEdit ? sensors : undefined}
      collisionDetection={collision}
      onDragStart={({ active: a }) => setActive((a.data.current?.task as Task) ?? null)}
      onDragCancel={() => setActive(null)}
      onDragEnd={onDragEnd}
    >
      <div className="grid auto-cols-[minmax(14.25rem,1fr)] grid-flow-col gap-gutter overflow-x-auto pb-space-sm">
        {STATUSES.map((s) => (
          <Column key={s} status={s} workspaceId={workspaceId} filters={filters} canEdit={canEdit} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180 }}>{active ? <TaskCard task={active} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}
