'use client';

import * as Popover from '@radix-ui/react-popover';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import { qk } from '@/lib/query-keys';
import type { AppNotification, WorkspaceRef } from '@/lib/types';

interface Inbox {
  items: AppNotification[];
  nextCursor: string | null;
  unreadCount: number;
}

const VERB: Record<AppNotification['type'], { text: string; icon: string; tone: string }> = {
  'task.assigned': { text: 'assigned you to', icon: 'person_add', tone: 'bg-primary-container' },
  'comment.mention': { text: 'mentioned you in', icon: 'alternate_email', tone: 'bg-secondary' },
  'comment.reply': { text: 'replied to your comment on', icon: 'reply', tone: 'bg-secondary' },
  'comment.created': { text: 'commented on', icon: 'chat_bubble', tone: 'bg-tertiary-container' },
};

export function NotificationsBell({ workspace }: { workspace: WorkspaceRef }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const key = qk.notifications(workspace.id);

  // Badge selalu aktif (diperbarui realtime); daftar lengkap dimuat saat popover dibuka.
  const count = useQuery({
    queryKey: [...key, 'count'],
    queryFn: () => api<{ unreadCount: number }>(`/workspaces/${workspace.id}/notifications/unread-count`),
    refetchInterval: 120_000,
  });
  const inbox = useQuery({
    queryKey: [...key, 'list', unreadOnly],
    queryFn: () => api<Inbox>(`/workspaces/${workspace.id}/notifications`, { query: { unread: unreadOnly || undefined, limit: 30 } }),
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (body: { ids: string[] } | { all: true }) =>
      api<{ unreadCount: number }>(`/workspaces/${workspace.id}/notifications/read`, { method: 'POST', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const unread = count.data?.unreadCount ?? 0;

  const openNotification = (n: AppNotification) => {
    if (!n.readAt) markRead.mutate({ ids: [n.id] });
    setOpen(false);
    if (n.projectId) {
      router.push(`/${workspace.slug}/projects/${n.projectId}${n.taskId ? `?task=${n.taskId}` : ''}`);
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
          className="relative hidden h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container/35 sm:flex"
        >
          <Icon name="notifications" size={20} />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold leading-none text-on-error ring-2 ring-surface">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-[80] flex max-h-[min(560px,80vh)] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl bg-surface-container-lowest shadow-level-3 ring-1 ring-surface-container focus:outline-none"
        >
          <div className="flex items-center justify-between border-b border-surface-container px-space-md py-space-sm">
            <h2 className="text-headline-sm text-on-surface">Notifications</h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={unreadOnly}
                onClick={() => setUnreadOnly((v) => !v)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-label-sm transition-colors',
                  unreadOnly ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'text-on-surface-variant hover:bg-surface-container',
                )}
              >
                Unread
              </button>
              <button
                type="button"
                disabled={unread === 0 || markRead.isPending}
                onClick={() => markRead.mutate({ all: true })}
                className="rounded-full px-2.5 py-1 text-label-sm text-primary transition-colors hover:bg-primary-fixed/40 disabled:text-outline disabled:hover:bg-transparent"
              >
                Mark all read
              </button>
            </div>
          </div>

          <div className="overflow-y-auto">
            {inbox.isLoading ? (
              <div className="flex flex-col gap-space-md p-space-md">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex gap-space-sm">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <Skeleton className="h-10 flex-1" />
                  </div>
                ))}
              </div>
            ) : inbox.isError ? (
              <ErrorState compact error={inbox.error} onRetry={() => inbox.refetch()} />
            ) : !inbox.data?.items.length ? (
              <EmptyState compact icon="notifications_off" title={unreadOnly ? 'All caught up' : 'No notifications yet'} description="Assignments, mentions and comments on your tasks show up here." />
            ) : (
              <ul className="divide-y divide-surface-container">
                {inbox.data.items.map((n) => {
                  const v = VERB[n.type];
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        className={cn(
                          'flex w-full items-start gap-space-sm px-space-md py-space-sm text-left transition-colors hover:bg-[#f8fafc]',
                          !n.readAt && 'bg-primary-fixed/20',
                        )}
                      >
                        <div className="relative mt-0.5 shrink-0">
                          <Avatar name={n.actor?.fullName ?? 'Someone'} seed={n.actor?.id} src={n.actor?.avatarUrl} size="md" />
                          <span className={cn('absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-white ring-2 ring-surface-container-lowest', v.tone)}>
                            <Icon name={v.icon} size={9} />
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-body-sm text-on-surface">
                            <strong className="font-semibold">{n.actor?.fullName ?? 'Someone'}</strong> {v.text}{' '}
                            <span className="font-medium text-primary">{n.metadata.key}</span> {n.metadata.title}
                          </p>
                          {n.metadata.excerpt && n.type !== 'task.assigned' && (
                            <p className="mt-0.5 line-clamp-2 text-[12px] text-on-surface-variant">“{n.metadata.excerpt}”</p>
                          )}
                          <time dateTime={n.createdAt} className="mt-0.5 block font-mono text-[10px] text-outline">
                            {timeAgo(n.createdAt)}
                          </time>
                        </div>
                        {!n.readAt && <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-container" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
