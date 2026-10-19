'use client';

import { useInfiniteQuery, useQuery, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { Page, TaskCard, TaskDetail, TaskFilters, TaskStatus } from '@/lib/types';

export const STATUSES: TaskStatus[] = ['backlog', 'in_progress', 'in_review', 'done'];

/** Ukuran halaman per kolom; kolom besar dimuat bertahap ("Load more"). */
export const COLUMN_PAGE_SIZE = 50;

export type ColumnData = InfiniteData<Page<TaskCard>, unknown>;

const filterQuery = (f: TaskFilters) => ({
  q: f.q,
  assigneeId: f.assigneeId,
  priority: f.priority?.length ? f.priority : undefined,
  tagId: f.tagId?.length ? f.tagId : undefined,
  milestoneId: f.milestoneId,
  overdue: f.overdue ? true : undefined,
});

export function useBoardColumn(projectId: string, status: TaskStatus, filters: TaskFilters) {
  return useInfiniteQuery({
    queryKey: qk.column(projectId, status, filters),
    queryFn: ({ pageParam, signal }) =>
      api<Page<TaskCard>>(`/projects/${projectId}/tasks`, {
        query: { status, ...filterQuery(filters), cursor: pageParam ?? undefined, limit: COLUMN_PAGE_SIZE },
        signal,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export const flattenColumn = (data: ColumnData | undefined) => data?.pages.flatMap((p) => p.items) ?? [];

/** Tulis ulang isi kolom (hasil drag) ke cache sebagai satu halaman, cursor lanjutan dipertahankan. */
export function withColumnItems(data: ColumnData | undefined, items: TaskCard[], totalDelta = 0): ColumnData {
  const last = data?.pages[data.pages.length - 1];
  const total = Math.max(items.length, (data?.pages[0]?.total ?? items.length) + totalDelta);
  return {
    pages: [{ items, nextCursor: last?.nextCursor ?? null, total }],
    pageParams: [data?.pageParams[0] ?? null],
  };
}

export const columnTotal = (data: ColumnData | undefined) =>
  data?.pages[0]?.total ?? flattenColumn(data).length;

/** Terapkan perubahan ke kartu task di semua kolom board project yang ter-cache. */
export function patchCardInBoard(
  queryClient: QueryClient,
  projectId: string,
  taskId: string,
  patch: Partial<TaskCard> | ((card: TaskCard) => TaskCard),
) {
  queryClient.setQueriesData<ColumnData>({ queryKey: qk.tasks(projectId) }, (data) => {
    if (!data?.pages) return data;
    return {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((card) =>
          card.id === taskId ? (typeof patch === 'function' ? patch(card) : { ...card, ...patch }) : card,
        ),
      })),
    };
  });
}

/** Ringkas detail task menjadi bentuk kartu (untuk sinkron cache board). */
export const toCard = ({ description: _d, deletedAt: _x, reporter: _r, milestone: _m, checklist: _c, ...card }: TaskDetail): TaskCard => card;

export const useTask = (taskId: string | null) =>
  useQuery({
    queryKey: qk.task(taskId ?? 'none'),
    queryFn: () => api<TaskDetail>(`/tasks/${taskId}`),
    enabled: !!taskId,
  });
