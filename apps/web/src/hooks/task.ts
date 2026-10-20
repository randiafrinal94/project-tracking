'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type {
  ActivityItem,
  ChecklistItem,
  Comment,
  MoveResult,
  Page,
  Tag,
  TaskCard,
  TaskDetail,
  TaskPriority,
  TaskStatus,
  UserRef,
} from '@/lib/types';
import { useToast } from '@/providers/toast-provider';
import { patchCardInBoard, toCard } from './board';

export interface TaskPatch {
  title?: string;
  description?: string | null;
  priority?: TaskPriority;
  assigneeId?: string | null;
  milestoneId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimateHours?: number | null;
  actualHours?: number;
}

/** Field tampilan yang ikut diubah optimistic (mis. objek assignee untuk avatar). */
export interface TaskPatchView {
  assignee?: UserRef | null;
  milestone?: { id: string; name: string } | null;
}

const checklistCounts = (checklist: ChecklistItem[]) => ({
  total: checklist.length,
  completed: checklist.filter((c) => c.isCompleted).length,
});

export function useTaskActions(taskId: string, projectId: string, workspaceId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = qk.task(taskId);

  const current = () => queryClient.getQueryData<TaskDetail>(key);

  /** Set detail + kartu board sekaligus. */
  const write = (next: TaskDetail) => {
    queryClient.setQueryData(key, next);
    patchCardInBoard(queryClient, projectId, taskId, toCard(next));
  };

  const refreshProjectSummaries = () => {
    queryClient.invalidateQueries({ queryKey: qk.projectActivity(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.project(projectId), exact: true });
    queryClient.invalidateQueries({ queryKey: qk.milestones(projectId) });
    queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
  };

  const refreshSummaries = () => {
    queryClient.invalidateQueries({ queryKey: qk.taskActivity(taskId) });
    queryClient.invalidateQueries({ queryKey: qk.projectActivity(projectId) });
    queryClient.invalidateQueries({ queryKey: qk.project(projectId), exact: true });
    queryClient.invalidateQueries({ queryKey: qk.milestones(projectId) });
    queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
  };

  const fail = (title: string) => (error: unknown, _v: unknown, ctx?: { previous?: TaskDetail }) => {
    if (ctx?.previous) write(ctx.previous);
    toast({ tone: 'error', title, description: (error as Error).message });
  };

  const update = useMutation({
    mutationFn: ({ patch }: { patch: TaskPatch; view?: TaskPatchView }) =>
      api<TaskDetail>(`/tasks/${taskId}`, { method: 'PATCH', body: patch }),
    onMutate: async ({ patch, view }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = current();
      if (previous) {
        const { assigneeId: _a, ...rest } = patch;
        write({ ...previous, ...rest, ...view } as TaskDetail);
      }
      return { previous };
    },
    onSuccess: (task) => {
      write(task);
      refreshSummaries();
    },
    onError: fail('Could not save changes'),
  });

  /** Ubah status dari detail: task ditaruh di akhir kolom tujuan. */
  const setStatus = useMutation({
    mutationFn: (status: TaskStatus) => api<MoveResult>(`/tasks/${taskId}/move`, { method: 'PATCH', body: { status } }),
    onMutate: async (status) => {
      const previous = current();
      if (previous) write({ ...previous, status, completedAt: status === 'done' ? new Date().toISOString() : null });
      return { previous };
    },
    onSuccess: ({ task }) => {
      write(task);
      // Kartu pindah kolom — muat ulang kolom board.
      queryClient.invalidateQueries({ queryKey: qk.tasks(projectId) });
      refreshSummaries();
    },
    onError: fail('Could not change status'),
  });

  const setTags = useMutation({
    mutationFn: ({ tagIds }: { tagIds: string[]; tags: TaskCard['tags'] }) =>
      api<TaskDetail>(`/tasks/${taskId}/tags`, { method: 'PUT', body: { tagIds } }),
    onMutate: ({ tags }) => {
      const previous = current();
      if (previous) write({ ...previous, tags });
      return { previous };
    },
    onSuccess: (task) => {
      write(task);
      queryClient.invalidateQueries({ queryKey: qk.tags(workspaceId) });
      refreshSummaries();
    },
    onError: fail('Could not update tags'),
  });

  const createTag = useMutation({
    mutationFn: (input: { name: string; color: string }) =>
      api<Tag>(`/workspaces/${workspaceId}/tags`, { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.tags(workspaceId) }),
    onError: (e) => toast({ tone: 'error', title: 'Could not create tag', description: (e as Error).message }),
  });

  // --- Checklist -------------------------------------------------------------

  const writeChecklist = (map: (list: ChecklistItem[]) => ChecklistItem[]) => {
    const previous = current();
    if (previous) {
      const checklist = map(previous.checklist);
      write({ ...previous, checklist, subtasks: checklistCounts(checklist) });
    }
    return { previous };
  };

  const addSubtask = useMutation({
    mutationFn: (title: string) =>
      api<ChecklistItem>(`/tasks/${taskId}/subtasks`, { method: 'POST', body: { title } }),
    onMutate: (title) =>
      writeChecklist((list) => [
        ...list,
        { id: `temp-${Date.now()}`, title, isCompleted: false, completedAt: null, sortOrder: Number.MAX_SAFE_INTEGER },
      ]),
    onSuccess: (item) => {
      // Ganti item sementara pertama dengan judul yang sama oleh item dari server.
      writeChecklist((list) => {
        const index = list.findIndex((c) => c.id.startsWith('temp-') && c.title === item.title);
        return index < 0 ? [...list, item] : list.map((c, i) => (i === index ? item : c));
      });
      refreshSummaries();
    },
    onError: fail('Could not add subtask'),
  });

  const updateSubtask = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; title?: string; isCompleted?: boolean }) =>
      api<ChecklistItem>(`/subtasks/${id}`, { method: 'PATCH', body: patch }),
    onMutate: ({ id, ...patch }) =>
      writeChecklist((list) =>
        list.map((c) =>
          c.id === id
            ? { ...c, ...patch, completedAt: patch.isCompleted === undefined ? c.completedAt : patch.isCompleted ? new Date().toISOString() : null }
            : c,
        ),
      ),
    onSuccess: (item) => {
      writeChecklist((list) => list.map((c) => (c.id === item.id ? item : c)));
      refreshSummaries();
    },
    onError: fail('Could not update subtask'),
  });

  const removeSubtask = useMutation({
    mutationFn: (id: string) => api(`/subtasks/${id}`, { method: 'DELETE' }),
    onMutate: (id) => writeChecklist((list) => list.filter((c) => c.id !== id)),
    onSuccess: refreshSummaries,
    onError: fail('Could not delete subtask'),
  });

  const remove = useMutation({
    mutationFn: () => api(`/tasks/${taskId}`, { method: 'DELETE' }),
    onSuccess: () => {
      // Buang cache detail setelah modal tertutup (observer aktif akan refetch → 404).
      setTimeout(() => queryClient.removeQueries({ queryKey: ['task', taskId], type: 'inactive' }), 1000);
      queryClient.invalidateQueries({ queryKey: qk.tasks(projectId) });
      refreshProjectSummaries();
      toast({ tone: 'success', title: 'Task deleted', description: 'An admin can restore it if needed.' });
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not delete task', description: (e as Error).message }),
  });

  return { update, setStatus, setTags, createTag, addSubtask, updateSubtask, removeSubtask, remove };
}

// ---------------------------------------------------------------------------
// Komentar & riwayat
// ---------------------------------------------------------------------------

export const useTaskComments = (taskId: string) =>
  useQuery({
    queryKey: qk.taskComments(taskId),
    queryFn: () => api<Page<Comment>>(`/tasks/${taskId}/comments`, { query: { limit: 100 } }),
  });

export const useTaskActivity = (taskId: string) =>
  useQuery({
    queryKey: qk.taskActivity(taskId),
    queryFn: () => api<Page<ActivityItem>>(`/tasks/${taskId}/activity`, { query: { limit: 50 } }),
  });

export function useCommentActions(taskId: string, projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const key = qk.taskComments(taskId);

  const after = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: qk.taskActivity(taskId) });
    queryClient.invalidateQueries({ queryKey: qk.projectActivity(projectId) });
  };
  const bumpCount = (delta: number) =>
    patchCardInBoard(queryClient, projectId, taskId, (card) => ({ ...card, commentCount: Math.max(0, card.commentCount + delta) }));

  const add = useMutation({
    mutationFn: ({ body, parentId }: { body: string; parentId?: string }) =>
      api<Comment>(`/tasks/${taskId}/comments`, { method: 'POST', body: { body, parentId } }),
    onSuccess: (comment) => {
      queryClient.setQueryData<Page<Comment>>(key, (page) => (page ? { ...page, items: [...page.items, comment] } : page));
      bumpCount(1);
      after();
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not post comment', description: (e as Error).message }),
  });

  const edit = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      api<Comment>(`/comments/${id}`, { method: 'PATCH', body: { body } }),
    onSuccess: (comment) => {
      queryClient.setQueryData<Page<Comment>>(key, (page) =>
        page ? { ...page, items: page.items.map((c) => (c.id === comment.id ? comment : c)) } : page,
      );
      after();
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not edit comment', description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/comments/${id}`, { method: 'DELETE' }),
    onMutate: (id) => {
      const previous = queryClient.getQueryData<Page<Comment>>(key);
      // Menghapus komentar akar ikut menghapus balasannya (sama dengan API).
      const removed = previous?.items.filter((c) => c.id === id || c.parentId === id).length ?? 1;
      queryClient.setQueryData<Page<Comment>>(key, (page) =>
        page ? { ...page, items: page.items.filter((c) => c.id !== id && c.parentId !== id) } : page,
      );
      return { previous, removed };
    },
    onSuccess: (_data, _id, ctx) => {
      bumpCount(-(ctx?.removed ?? 1));
      after();
    },
    onError: (e, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast({ tone: 'error', title: 'Could not delete comment', description: (e as Error).message });
    },
  });

  const like = useMutation({
    mutationFn: ({ id, liked }: { id: string; liked: boolean }) =>
      api<Pick<Comment, 'id' | 'likeCount' | 'likedByMe'>>(`/comments/${id}/like`, { method: liked ? 'POST' : 'DELETE' }),
    onMutate: ({ id, liked }) => {
      const previous = queryClient.getQueryData<Page<Comment>>(key);
      queryClient.setQueryData<Page<Comment>>(key, (page) =>
        page
          ? {
              ...page,
              items: page.items.map((c) =>
                c.id === id && c.likedByMe !== liked
                  ? { ...c, likedByMe: liked, likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1)) }
                  : c,
              ),
            }
          : page,
      );
      return { previous };
    },
    onSuccess: (state) => {
      queryClient.setQueryData<Page<Comment>>(key, (page) =>
        page ? { ...page, items: page.items.map((c) => (c.id === state.id ? { ...c, ...state } : c)) } : page,
      );
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast({ tone: 'error', title: 'Could not update like', description: (e as Error).message });
    },
  });

  return { add, edit, remove, like };
}
