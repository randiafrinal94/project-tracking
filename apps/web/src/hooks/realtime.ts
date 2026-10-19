'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getAccessToken, refreshSession } from '@/lib/api';
import { qk } from '@/lib/query-keys';

interface RealtimeEvent {
  type: 'activity' | 'notification';
  workspaceId: string;
  projectId?: string | null;
  taskId?: string | null;
  actorId?: string | null;
  action?: string;
}

const FLUSH_MS = 400;

/**
 * Langganan SSE `/api/v1/events` untuk workspace aktif. Event dikumpulkan lalu
 * diterjemahkan menjadi invalidasi cache TanStack Query (batched per 400 ms).
 * Perubahan board oleh user sendiri diabaikan karena sudah diterapkan optimistic.
 */
export function useRealtime(workspaceId: string, currentUserId: string) {
  const queryClient = useQueryClient();
  const pending = useRef<RealtimeEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let attempts = 0;

    const flush = () => {
      timer.current = null;
      const events = pending.current.splice(0);
      const projects = new Set<string>();
      const tasks = new Set<string>();
      let notification = false;
      let workspaceWide = false;

      for (const e of events) {
        if (e.type === 'notification') {
          notification = true;
          continue;
        }
        workspaceWide = true;
        const fromMe = e.actorId === currentUserId;
        if (e.projectId && !(fromMe && (e.action === 'task.moved' || e.action === 'task.reordered'))) {
          projects.add(e.projectId);
        }
        if (e.taskId && !fromMe) tasks.add(e.taskId);
      }

      for (const projectId of projects) {
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      }
      for (const taskId of tasks) queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      if (workspaceWide) queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
      if (notification) queryClient.invalidateQueries({ queryKey: qk.notifications(workspaceId) });
    };

    const enqueue = (event: RealtimeEvent) => {
      pending.current.push(event);
      timer.current ??= setTimeout(flush, FLUSH_MS);
    };

    const connect = async () => {
      if (disposed) return;
      // Token kedaluwarsa (15 menit) → refresh sebelum menyambung ulang.
      const token = attempts > 0 ? (await refreshSession())?.accessToken : getAccessToken();
      if (!token || disposed) return;
      source = new EventSource(`/api/v1/events?workspaceId=${workspaceId}&token=${encodeURIComponent(token)}`);
      source.addEventListener('ready', () => {
        attempts = 0;
      });
      source.addEventListener('activity', (msg) => enqueue(JSON.parse((msg as MessageEvent).data)));
      source.addEventListener('notification', (msg) => enqueue(JSON.parse((msg as MessageEvent).data)));
      source.onerror = () => {
        source?.close();
        source = null;
        attempts += 1;
        // Saat terputus, data mungkin tertinggal → segarkan tampilan aktif.
        queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
        retry = setTimeout(() => void connect(), Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5)));
      };
    };

    void connect();
    return () => {
      disposed = true;
      source?.close();
      if (retry) clearTimeout(retry);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [workspaceId, currentUserId, queryClient]);
}
