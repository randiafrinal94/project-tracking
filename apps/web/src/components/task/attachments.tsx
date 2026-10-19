'use client';

import { useRef, useState, type DragEvent } from 'react';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { MAX_UPLOAD_MB, useAttachmentActions, useAttachments, usePreviewUrl } from '@/hooks/attachments';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import type { Attachment, UserRef } from '@/lib/types';

export const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

const extension = (name: string) => (name.includes('.') ? name.split('.').pop()!.toUpperCase().slice(0, 4) : 'FILE');

/** Tile ikon per jenis file (Stitch: PDF merah, video biru). */
function fileTile(a: Attachment): { icon: string; className: string } {
  if (a.mimeType === 'application/pdf') return { icon: 'picture_as_pdf', className: 'bg-error-container text-error' };
  if (a.mimeType.startsWith('video/')) return { icon: 'videocam', className: 'bg-secondary-fixed text-secondary' };
  if (a.mimeType.startsWith('image/')) return { icon: 'image', className: 'bg-primary-fixed text-primary-container' };
  if (/zip|compressed|tar/.test(a.mimeType)) return { icon: 'folder_zip', className: 'bg-review-soft text-on-review-soft' };
  if (/sheet|csv|excel/.test(a.mimeType)) return { icon: 'table_chart', className: 'bg-tertiary-fixed text-tertiary-container' };
  return { icon: 'description', className: 'bg-surface-container-high text-on-surface-variant' };
}

function ImageCard({ attachment, onOpen, footer }: { attachment: Attachment; onOpen: () => void; footer: React.ReactNode }) {
  const { url, loading, error } = usePreviewUrl(attachment);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Download ${attachment.fileName}`}
      className="group flex w-full flex-col overflow-hidden rounded-xl bg-surface-container-low text-left shadow-xs transition-shadow hover:shadow-md"
    >
      <div className="relative h-28 w-full overflow-hidden bg-surface-container-high">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={attachment.fileName} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : loading ? (
          <Skeleton className="h-full w-full rounded-none" />
        ) : (
          <div className="flex h-full items-center justify-center text-outline">
            <Icon name={error ? 'broken_image' : 'image'} size={28} />
          </div>
        )}
        <span className="absolute right-2 top-2 rounded bg-inverse-surface/80 px-1.5 py-0.5 font-mono text-[10px] text-inverse-on-surface">
          {extension(attachment.fileName)}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 p-2.5">{footer}</div>
    </button>
  );
}

/** Section "Attachments" Stitch: header + Upload files, grid 3 kolom kartu file. */
export function Attachments({
  taskId,
  projectId,
  currentUser,
  canUpload,
  isAdmin,
}: {
  taskId: string;
  projectId: string;
  currentUser: UserRef;
  canUpload: boolean;
  isAdmin: boolean;
}) {
  const list = useAttachments(taskId);
  const { upload, remove, download } = useAttachmentActions(taskId, projectId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const items = list.data ?? [];

  const send = (files: File[]) => {
    setLocalError(null);
    if (files.length === 0) return;
    const tooBig = files.find((f) => f.size > MAX_UPLOAD_MB * 1024 * 1024);
    if (tooBig) return setLocalError(`"${tooBig.name}" is larger than ${MAX_UPLOAD_MB} MB.`);
    upload.mutate(files.slice(0, 10));
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (canUpload) send([...e.dataTransfer.files]);
  };

  const footer = (a: Attachment) => (
    <>
      <span className="truncate text-label-sm font-semibold text-on-surface" title={a.fileName}>
        {a.fileName}
      </span>
      <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant">
        <span className="tabular">{formatBytes(a.sizeBytes)}</span>
        <span className="truncate">
          {timeAgo(a.createdAt)}
          {a.uploadedBy && ` • ${a.uploadedBy.fullName.split(' ')[0]}`}
        </span>
      </div>
    </>
  );

  return (
    <section
      aria-label="Attachments"
      className={cn('flex flex-col gap-space-sm rounded-xl transition-colors', dragging && 'bg-primary-fixed/20 ring-2 ring-primary-container/30')}
      onDragOver={(e) => {
        if (!canUpload || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-label-md font-semibold text-on-surface">
          <Icon name="attach_file" size={18} className="text-outline" />
          Attachments ({items.length})
        </span>
        {canUpload && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
              className="flex items-center gap-1 text-label-sm text-primary transition-colors hover:text-primary-container disabled:opacity-60"
            >
              {upload.isPending ? <Spinner size={14} /> : <Icon name="upload" size={16} />}
              <span>{upload.isPending ? 'Uploading…' : 'Upload files'}</span>
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              aria-label="Choose files to upload"
              onChange={(e) => {
                send([...(e.target.files ?? [])]);
                e.target.value = '';
              }}
            />
          </>
        )}
      </div>

      {localError && (
        <p role="alert" className="text-body-sm text-error">
          {localError}
        </p>
      )}

      {list.isLoading ? (
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[150px] rounded-xl" />)}
        </div>
      ) : list.isError ? (
        <ErrorState compact error={list.error} onRetry={() => list.refetch()} title="Attachments unavailable" />
      ) : items.length === 0 ? (
        <button
          type="button"
          disabled={!canUpload}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-outline-variant/70 px-space-md py-space-lg text-center text-body-sm text-on-surface-variant enabled:hover:border-primary-container enabled:hover:bg-primary-fixed/10"
        >
          <Icon name="cloud_upload" size={22} className="text-outline" />
          {canUpload ? `Drop files here or click to upload (max ${MAX_UPLOAD_MB} MB each)` : 'No attachments'}
        </button>
      ) : (
        <ul className="grid grid-cols-1 gap-space-md md:grid-cols-3">
          {items.map((a) => {
            const canDelete = a.uploadedBy?.id === currentUser.id || isAdmin;
            const tile = fileTile(a);
            return (
              <li key={a.id} className="group/att relative">
                {a.previewable ? (
                  <ImageCard attachment={a} onOpen={() => void download(a)} footer={footer(a)} />
                ) : (
                  <button
                    type="button"
                    onClick={() => void download(a)}
                    title={`Download ${a.fileName}`}
                    className="group flex h-full min-h-[150px] w-full flex-col justify-between rounded-xl bg-surface-container-low p-space-md text-left shadow-xs transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tile.className)}>
                        <Icon name={tile.icon} size={24} />
                      </div>
                      <Icon name="download" size={18} className="text-outline-variant group-hover:text-on-surface" />
                    </div>
                    <div className="flex flex-col gap-0.5 pt-4">{footer(a)}</div>
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    aria-label={`Delete ${a.fileName}`}
                    onClick={() => remove.mutate(a.id)}
                    className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-surface-container-lowest/90 text-on-surface-variant opacity-0 shadow-xs transition-opacity hover:bg-error-container hover:text-on-error-container focus-visible:opacity-100 group-hover/att:opacity-100"
                  >
                    <Icon name="delete" size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
