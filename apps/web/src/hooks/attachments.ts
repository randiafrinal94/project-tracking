'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, apiBlob } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { Attachment } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';
import { patchCardInBoard } from './board';

export const MAX_UPLOAD_MB = 10;

export const useAttachments = (taskId: string) =>
  useQuery({
    queryKey: qk.attachments(taskId),
    queryFn: () => api<Attachment[]>(`/tasks/${taskId}/attachments`),
  });

export function useAttachmentActions(taskId: string, projectId: string) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const sync = (delta: number) => {
    patchCardInBoard(queryClient, projectId, taskId, (card) => ({
      ...card,
      attachmentCount: Math.max(0, card.attachmentCount + delta),
    }));
    queryClient.invalidateQueries({ queryKey: qk.taskActivity(taskId) });
    queryClient.invalidateQueries({ queryKey: qk.projectActivity(projectId) });
  };

  const upload = useMutation({
    mutationFn: (files: File[]) => {
      const form = new FormData();
      for (const file of files) form.append('file', file);
      return api<Attachment[]>(`/tasks/${taskId}/attachments`, { method: 'POST', rawBody: form });
    },
    onSuccess: (created) => {
      queryClient.setQueryData<Attachment[]>(qk.attachments(taskId), (list) => [...created, ...(list ?? [])]);
      sync(created.length);
      toast({ tone: 'success', title: `${created.length} file${created.length === 1 ? '' : 's'} uploaded` });
    },
    onError: (e) => toast({ tone: 'error', title: 'Upload failed', description: (e as Error).message }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/attachments/${id}`, { method: 'DELETE' }),
    onMutate: (id) => {
      const previous = queryClient.getQueryData<Attachment[]>(qk.attachments(taskId));
      queryClient.setQueryData<Attachment[]>(qk.attachments(taskId), (list) => list?.filter((a) => a.id !== id));
      return { previous };
    },
    onSuccess: () => sync(-1),
    onError: (e, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(qk.attachments(taskId), ctx.previous);
      toast({ tone: 'error', title: 'Could not delete file', description: (e as Error).message });
    },
  });

  /** Unduh lewat fetch berotorisasi lalu picu dialog simpan browser. */
  const download = async (attachment: Attachment) => {
    try {
      const blob = await apiBlob(`/attachments/${attachment.id}/download`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast({ tone: 'error', title: 'Download failed', description: (e as Error).message });
    }
  };

  return { upload, remove, download };
}

/** Object URL untuk preview gambar (dibersihkan saat unmount). */
export function usePreviewUrl(attachment: Attachment) {
  const blob = useQuery({
    queryKey: qk.attachmentBlob(attachment.id),
    queryFn: () => apiBlob(`/attachments/${attachment.id}/download`, { query: { inline: '1' } }),
    enabled: attachment.previewable,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
  });
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob.data) return;
    const next = URL.createObjectURL(blob.data);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob.data]);

  return { url, loading: blob.isLoading, error: blob.isError };
}
