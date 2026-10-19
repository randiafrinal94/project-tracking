'use client';

import {
  closestCenter,
  DndContext,
  DragOverlay,
  getFirstCollision,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  columnTotal,
  flattenColumn,
  patchCardInBoard,
  STATUSES,
  toCard,
  useBoardColumn,
  withColumnItems,
  type ColumnData,
} from '@/hooks/board';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { MoveResult, Project, TaskCard as Task, TaskDetail, TaskFilters, TaskStatus } from '@/lib/types';
import { TASK_STATUS } from '@/components/ui/badge';
import { useToast } from '@/providers/toast-provider';
import { BoardColumn } from './board-column';
import { TaskCard } from './task-card';

type Columns = Record<TaskStatus, Task[]>;

interface DragState {
  items: Columns;
  activeId: string;
  from: TaskStatus;
  fromIndex: number;
}

const isColumnId = (id: UniqueIdentifier) => String(id).startsWith('column:');

function findStatus(id: UniqueIdentifier, items: Columns): TaskStatus | undefined {
  if (isColumnId(id)) return String(id).slice('column:'.length) as TaskStatus;
  return STATUSES.find((s) => items[s].some((t) => t.id === id));
}

/**
 * Keyboard: ←/→ melompat ke kolom status sebelah, ↑/↓ memakai urutan sortable bawaan.
 * (`sortableKeyboardCoordinates` sendiri tidak berpindah antar kontainer.)
 */
const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const { active, droppableRects } = args.context;
  if ((event.code === 'ArrowRight' || event.code === 'ArrowLeft') && active) {
    event.preventDefault();
    const containerId = String(active.data.current?.sortable?.containerId ?? '');
    const index = STATUSES.indexOf(containerId.slice('column:'.length) as TaskStatus);
    const target = STATUSES[index + (event.code === 'ArrowRight' ? 1 : -1)];
    const rect = target ? droppableRects.get(`column:${target}`) : undefined;
    return rect ? { x: rect.left + 8, y: rect.top + 8 } : undefined;
  }
  return sortableKeyboardCoordinates(event, args);
};

/** Perubahan lokal saat kartu pindah status (sebelum server menjawab). */
const withStatus = (task: Task, status: TaskStatus): Task =>
  task.status === status
    ? task
    : { ...task, status, completedAt: status === 'done' ? new Date().toISOString() : null };

export function KanbanBoard({
  project,
  filters,
  canEdit,
  onOpenTask,
}: {
  project: Project;
  filters: TaskFilters;
  canEdit: boolean;
  onOpenTask: (taskId: string) => void;
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const backlog = useBoardColumn(project.id, 'backlog', filters);
  const inProgress = useBoardColumn(project.id, 'in_progress', filters);
  const inReview = useBoardColumn(project.id, 'in_review', filters);
  const done = useBoardColumn(project.id, 'done', filters);
  const queries = { backlog, in_progress: inProgress, in_review: inReview, done };

  const server = useMemo<Columns>(
    () => ({
      backlog: flattenColumn(backlog.data),
      in_progress: flattenColumn(inProgress.data),
      in_review: flattenColumn(inReview.data),
      done: flattenColumn(done.data),
    }),
    [backlog.data, inProgress.data, inReview.data, done.data],
  );

  const [drag, setDrag] = useState<DragState | null>(null);
  const view = drag?.items ?? server;
  const activeTask = drag ? STATUSES.flatMap((s) => drag.items[s]).find((t) => t.id === drag.activeId) : undefined;

  /**
   * Collision multi-kolom (pola resmi dnd-kit): pointer → irisan rect; bila mengenai
   * kolom, pilih kartu terdekat di kolom tsb. Setelah kartu pindah kolom, target terakhir
   * dikunci satu frame agar tidak "memantul" kembali ke kolom asal saat layout bergeser.
   */
  const lastOverId = useRef<UniqueIdentifier | null>(null);
  const recentlyMovedColumn = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointer = pointerWithin(args);
    const hits = pointer.length > 0 ? pointer : rectIntersection(args);
    let overId = getFirstCollision(hits, 'id');

    if (overId != null) {
      if (isColumnId(overId)) {
        const status = String(overId).slice('column:'.length) as TaskStatus;
        const ids = new Set(viewRef.current[status].map((t) => t.id));
        if (ids.size > 0) {
          overId =
            closestCenter({
              ...args,
              droppableContainers: args.droppableContainers.filter((c) => ids.has(String(c.id))),
            })[0]?.id ?? overId;
        }
      }
      lastOverId.current = overId;
      return [{ id: overId }];
    }
    if (recentlyMovedColumn.current) lastOverId.current = args.active.id;
    return lastOverId.current ? [{ id: lastOverId.current }] : [];
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      recentlyMovedColumn.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [view]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: boardKeyboardCoordinates }),
  );

  const keyFor = (status: TaskStatus) => qk.column(project.id, status, filters);

  const invalidateSummaries = () => {
    queryClient.invalidateQueries({ queryKey: qk.project(project.id), exact: true });
    queryClient.invalidateQueries({ queryKey: qk.projectActivity(project.id) });
    queryClient.invalidateQueries({ queryKey: qk.milestones(project.id) });
    queryClient.invalidateQueries({ queryKey: ['workspace', project.workspaceId] });
  };

  const move = useMutation({
    mutationFn: (v: { taskId: string; status: TaskStatus; prevTaskId: string | null; nextTaskId: string | null; snapshot: [TaskStatus, ColumnData | undefined][] }) =>
      api<MoveResult>(`/tasks/${v.taskId}/move`, {
        method: 'PATCH',
        body: { status: v.status, prevTaskId: v.prevTaskId, nextTaskId: v.prevTaskId ? undefined : v.nextTaskId },
      }),
    onSuccess: (result, v) => {
      patchCardInBoard(queryClient, project.id, v.taskId, toCard(result.task));
      queryClient.setQueryData<TaskDetail>(qk.task(v.taskId), result.task);
      if (result.rebalanced) queryClient.invalidateQueries({ queryKey: keyFor(v.status) });
      invalidateSummaries();
    },
    onError: (error, v) => {
      // Rollback ke posisi sebelum drag (SKILL.md §2.3).
      for (const [status, data] of v.snapshot) queryClient.setQueryData(keyFor(status), data);
      queryClient.invalidateQueries({ queryKey: qk.tasks(project.id) });
      toast({ tone: 'error', title: 'Could not move task', description: `${(error as Error).message}. The card was returned to its previous position.` });
    },
  });

  const quickAdd = useMutation({
    mutationFn: (v: { status: TaskStatus; title: string }) =>
      api<TaskDetail>(`/projects/${project.id}/tasks`, { method: 'POST', body: v }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: keyFor(task.status) });
      invalidateSummaries();
      toast({ tone: 'success', title: `${task.key} created`, description: task.title });
    },
    onError: (error) => toast({ tone: 'error', title: 'Could not create task', description: (error as Error).message }),
  });

  // --- Drag handlers -------------------------------------------------------

  const onDragStart = ({ active }: DragStartEvent) => {
    const from = findStatus(active.id, server);
    if (!from) return;
    setDrag({
      items: { ...server },
      activeId: String(active.id),
      from,
      fromIndex: server[from].findIndex((t) => t.id === active.id),
    });
  };

  /** Pindahkan kartu antar kolom selama drag agar kolom tujuan menampilkan slot. */
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!drag || !over) return;
    const from = findStatus(active.id, drag.items);
    const to = findStatus(over.id, drag.items);
    if (!from || !to || from === to) return;

    recentlyMovedColumn.current = true;
    setDrag((state) => {
      if (!state) return state;
      const source = state.items[from];
      const target = state.items[to];
      const card = source.find((t) => t.id === active.id);
      if (!card) return state;
      const overIndex = isColumnId(over.id) ? target.length : target.findIndex((t) => t.id === over.id);
      const below =
        over.rect && active.rect.current.translated && active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
      const insertAt = overIndex < 0 ? target.length : overIndex + (below ? 1 : 0);
      const nextTarget = [...target];
      nextTarget.splice(insertAt, 0, withStatus(card, to));
      return {
        ...state,
        items: { ...state.items, [from]: source.filter((t) => t.id !== active.id), [to]: nextTarget },
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!drag || !over) return setDrag(null);
    const status = findStatus(active.id, drag.items);
    if (!status) return setDrag(null);

    let list = drag.items[status];
    const overStatus = findStatus(over.id, drag.items);
    if (overStatus === status && !isColumnId(over.id)) {
      const oldIndex = list.findIndex((t) => t.id === active.id);
      const newIndex = list.findIndex((t) => t.id === over.id);
      if (oldIndex !== newIndex) list = arrayMove(list, oldIndex, newIndex);
    }
    const index = list.findIndex((t) => t.id === active.id);

    if (status === drag.from && index === drag.fromIndex) return setDrag(null); // tidak berubah

    const prevTaskId = list[index - 1]?.id ?? null;
    const nextTaskId = list[index + 1]?.id ?? null;
    const affected = [...new Set<TaskStatus>([drag.from, status])];
    const snapshot = affected.map((s) => [s, queryClient.getQueryData<ColumnData>(keyFor(s))] as [TaskStatus, ColumnData | undefined]);

    // Optimistic: tulis susunan akhir ke cache, lalu lepaskan state drag di render yang sama.
    const finalItems = { ...drag.items, [status]: list };
    for (const s of affected) {
      const delta = drag.from === status ? 0 : s === status ? 1 : -1;
      queryClient.setQueryData<ColumnData>(keyFor(s), (data) => withColumnItems(data, finalItems[s], delta));
    }
    setDrag(null);

    move.mutate({ taskId: String(active.id), status, prevTaskId, nextTaskId, snapshot });
  };

  /** Detail task dimuat saat hover/fokus agar modal terbuka tanpa skeleton. */
  const prefetchTask = useCallback(
    (taskId: string) =>
      void queryClient.prefetchQuery({
        queryKey: qk.task(taskId),
        queryFn: () => api<TaskDetail>(`/tasks/${taskId}`),
        staleTime: 30_000,
      }),
    [queryClient],
  );

  // Petunjuk overflow: gradien tepi bila ada kolom di luar viewport (mis. Done pada layar ≤1600px).
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  const updateEdges = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = { left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 };
    setEdges((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges]);

  const filtered = Object.values(filters).some((v) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== ''));

  return (
    <DndContext
      sensors={canEdit ? sensors : undefined}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDrag(null)}
      accessibility={{
        screenReaderInstructions: {
          draggable: 'Press space or enter to pick up a task. Use arrow keys to move it, space to drop, escape to cancel.',
        },
        announcements: {
          onDragStart: ({ active }) => `Picked up task ${String(active.id).slice(0, 8)}.`,
          onDragOver: ({ over }) => (over ? `Over ${TASK_STATUS[findStatus(over.id, view) ?? 'backlog'].label}.` : 'Not over a column.'),
          onDragEnd: ({ over }) => (over ? `Dropped in ${TASK_STATUS[findStatus(over.id, view) ?? 'backlog'].label}.` : 'Drop cancelled.'),
          onDragCancel: () => 'Drag cancelled. The task returned to its original position.',
        },
      }}
    >
      <div className="relative">
      {edges.left && <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 rounded-l-xl bg-gradient-to-r from-surface to-transparent" />}
      {edges.right && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-10 items-start justify-end bg-gradient-to-l from-surface to-transparent pt-3">
          <span className="material-symbols-outlined text-[18px] text-outline">chevron_right</span>
        </div>
      )}
      <div
        ref={scrollRef}
        onScroll={updateEdges}
        // 4 × 228px + 3 celah = 960px: muat di desktop 1280px dengan sidebar penuh (Done selalu terlihat).
        className="grid auto-cols-[minmax(14.25rem,1fr)] grid-flow-col gap-gutter overflow-x-auto pb-space-sm"
      >
        {STATUSES.map((status) => {
          const q = queries[status];
          const dragDelta = drag ? view[status].length - server[status].length : 0;
          return (
            <BoardColumn
              key={status}
              status={status}
              tasks={view[status]}
              total={columnTotal(q.data) + dragDelta}
              loading={q.isLoading}
              error={q.isError ? q.error : undefined}
              onRetry={() => q.refetch()}
              hasMore={!!q.hasNextPage}
              loadingMore={q.isFetchingNextPage}
              onLoadMore={() => q.fetchNextPage()}
              canEdit={canEdit}
              filtered={filtered}
              onOpenTask={onOpenTask}
              onPrefetchTask={prefetchTask}
              onQuickAdd={(s, title) => quickAdd.mutateAsync({ status: s, title })}
            />
          );
        })}
      </div>
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
        {activeTask ? <TaskCard task={activeTask} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
