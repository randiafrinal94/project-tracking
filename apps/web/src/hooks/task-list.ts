'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Page, TaskCard, TaskFilters, TaskSort } from '@/lib/types';

export const LIST_PAGE_SIZE = 100;

export interface TaskListScope {
  kind: 'project' | 'workspace';
  id: string;
}

const toQuery = (f: TaskFilters) => ({
  projectId: f.projectId,
  status: f.status,
  q: f.q,
  assigneeId: f.assigneeId,
  priority: f.priority?.length ? f.priority : undefined,
  tagId: f.tagId?.length ? f.tagId : undefined,
  milestoneId: f.milestoneId,
  overdue: f.overdue ? true : undefined,
});

/**
 * Daftar task berurutan bebas (List view / halaman Tasks) dengan paginasi offset.
 * Halaman dimuat bertahap oleh virtualizer saat user menggulir mendekati akhir.
 */
export function useTaskList(scope: TaskListScope, filters: TaskFilters, sort: TaskSort, dir: 'asc' | 'desc') {
  const base = scope.kind === 'project' ? `/projects/${scope.id}/tasks` : `/workspaces/${scope.id}/tasks`;
  return useInfiniteQuery({
    queryKey: [scope.kind === 'project' ? 'project' : 'workspace', scope.id, 'tasks', 'list', filters, sort, dir],
    queryFn: ({ pageParam, signal }) =>
      api<Page<TaskCard>>(base, {
        query: {
          ...toQuery(filters),
          sort: sort === 'board' ? 'key' : sort,
          dir,
          offset: pageParam,
          limit: LIST_PAGE_SIZE,
        },
        signal,
      }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextOffset ?? undefined,
  });
}
