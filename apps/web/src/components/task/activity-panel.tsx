'use client';

import { useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { TASK_STATUS } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownTrigger } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { MentionTextarea, handleOf } from './mention-textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { useCommentActions, useTaskActivity, useTaskComments } from '@/hooks/task';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import type { ActivityItem, Comment, TaskStatus, UserRef, WorkspaceMember } from '@/lib/types';

type Tab = 'all' | 'comments' | 'history';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Kalimat riwayat sistem gaya Stitch: "moved status from ~~To Do~~ to **In Progress**". */
function historyText(item: ActivityItem): ReactNode {
  const m = item.metadata as Record<string, unknown>;
  switch (item.action) {
    case 'task.created':
      return 'created this task';
    case 'task.moved': {
      const from = TASK_STATUS[str(m.from) as TaskStatus];
      const to = TASK_STATUS[str(m.to) as TaskStatus];
      return (
        <>
          moved status from <span className="line-through">{from?.label ?? str(m.from)}</span> to{' '}
          <strong className={cn('font-medium', to?.text)}>{to?.label ?? str(m.to)}</strong>
        </>
      );
    }
    case 'task.assigned':
      return m.to ? 'changed the assignee' : 'removed the assignee';
    case 'task.priority_changed':
      return (
        <>
          changed priority from {str(m.from)} to <strong className="font-medium text-on-surface">{str(m.to)}</strong>
        </>
      );
    case 'task.updated': {
      const fields = Array.isArray(m.fields) ? (m.fields as string[]) : [];
      const label: Record<string, string> = {
        title: 'title', description: 'description', milestoneId: 'milestone', startDate: 'start date',
        dueDate: 'due date', estimateHours: 'estimate', actualHours: 'logged time',
      };
      return `updated ${fields.map((f) => label[f] ?? f).join(', ') || 'details'}`;
    }
    case 'task.tag_added':
      return <>added tag <strong className="font-medium text-on-surface">{str(m.tag)}</strong></>;
    case 'task.tag_removed':
      return <>removed tag <strong className="font-medium text-on-surface">{str(m.tag)}</strong></>;
    case 'subtask.created':
      return <>added subtask “{str(m.title)}”</>;
    case 'subtask.completed':
      return <>completed “{str(m.title)}”</>;
    case 'subtask.reopened':
      return <>reopened “{str(m.title)}”</>;
    case 'subtask.updated':
      return <>renamed a subtask to “{str(m.title)}”</>;
    case 'subtask.deleted':
      return <>deleted subtask “{str(m.title)}”</>;
    case 'comment.created':
      return 'commented';
    case 'comment.edited':
      return 'edited a comment';
    case 'comment.deleted':
      return 'deleted a comment';
    case 'task.restored':
      return 'restored this task';
    case 'attachment.added':
      return <>attached <strong className="font-medium text-on-surface">{str(m.fileName)}</strong></>;
    case 'attachment.removed':
      return <>removed attachment <strong className="font-medium text-on-surface">{str(m.fileName)}</strong></>;
    default:
      return item.action;
  }
}

function SystemLine({ item }: { item: ActivityItem }) {
  const isMove = item.action === 'task.moved';
  return (
    <div className="flex items-center gap-space-md pl-3">
      <div className={cn('h-2 w-2 shrink-0 rounded-full', isMove ? 'bg-secondary' : 'bg-outline-variant')} />
      <p className="text-[12px] text-on-surface-variant">
        <span className="font-semibold text-on-surface">{item.actor?.fullName ?? 'System'}</span> {historyText(item)}
        <span className="text-outline"> • {timeAgo(item.createdAt)}</span>
      </p>
    </div>
  );
}

function CommentItem({
  comment,
  canEdit,
  canDelete,
  canInteract,
  onEdit,
  onDelete,
  onLike,
  onReply,
  members,
}: {
  comment: Comment;
  canEdit: boolean;
  canDelete: boolean;
  /** Boleh suka & balas (member+). */
  canInteract: boolean;
  onEdit: (body: string) => Promise<unknown>;
  onDelete: () => void;
  onLike: (liked: boolean) => void;
  onReply: () => void;
  members: WorkspaceMember[];
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [saving, setSaving] = useState(false);
  const isReply = !!comment.parentId;

  return (
    <article className="flex items-start gap-space-md">
      <Avatar
        name={comment.author?.fullName ?? 'Deleted user'}
        seed={comment.author?.id}
        src={comment.author?.avatarUrl}
        size={isReply ? 'md' : 'lg'}
        ring
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-label-md font-semibold text-on-surface">{comment.author?.fullName ?? 'Deleted user'}</span>
            <time dateTime={comment.createdAt} className="text-[12px] text-outline">
              {timeAgo(comment.createdAt)}
            </time>
            {comment.edited && <span className="text-[11px] text-outline">(edited)</span>}
          </div>
          {(canEdit || canDelete) && !editing && (
            <Dropdown>
              <DropdownTrigger asChild>
                <button type="button" aria-label="Comment options" className="text-outline-variant hover:text-on-surface">
                  <Icon name="more_horiz" size={16} />
                </button>
              </DropdownTrigger>
              <DropdownContent align="end" className="min-w-[160px]">
                {canEdit && (
                  <DropdownItem icon="edit" onSelect={() => { setDraft(comment.body); setEditing(true); }}>
                    Edit
                  </DropdownItem>
                )}
                {canDelete && (
                  <DropdownItem icon="delete" destructive onSelect={onDelete}>
                    Delete
                  </DropdownItem>
                )}
              </DropdownContent>
            </Dropdown>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <MentionTextarea rows={3} value={draft} members={members} autoFocus aria-label="Edit comment" onValueChange={setDraft} />
            <div className="flex justify-end gap-1">
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                loading={saving}
                disabled={!draft.trim()}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await onEdit(draft.trim());
                    setEditing(false);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              className="rich-text rounded-xl bg-surface-container-lowest p-space-md text-body-sm leading-normal text-on-surface shadow-xs"
              // bodyHtml dirender & disanitasi (allowlist) oleh API.
              dangerouslySetInnerHTML={{ __html: comment.bodyHtml }}
            />
            <div className="flex items-center gap-space-md pl-1 text-[12px]">
              <button
                type="button"
                aria-pressed={comment.likedByMe}
                aria-label={comment.likedByMe ? 'Unlike comment' : 'Like comment'}
                disabled={!canInteract}
                onClick={() => onLike(!comment.likedByMe)}
                className={cn(
                  'flex items-center gap-1 font-medium transition-colors disabled:cursor-default',
                  comment.likedByMe ? 'text-primary' : 'text-outline enabled:hover:text-on-surface',
                )}
              >
                <Icon name="thumb_up" size={15} filled={comment.likedByMe} />
                {comment.likedByMe ? 'Liked' : 'Like'}
                {comment.likeCount > 0 && <span className="tabular-nums">· {comment.likeCount}</span>}
              </button>
              {canInteract && (
                <button
                  type="button"
                  onClick={onReply}
                  className="flex items-center gap-1 font-medium text-outline transition-colors hover:text-on-surface"
                >
                  <Icon name="reply" size={15} />
                  Reply
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}

function ReplyComposer({
  currentUser,
  members,
  initial,
  pending,
  onSubmit,
  onCancel,
}: {
  currentUser: UserRef;
  members: WorkspaceMember[];
  initial: string;
  pending: boolean;
  onSubmit: (body: string) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    await onSubmit(body);
  };

  return (
    <div className="flex items-start gap-space-md">
      <Avatar name={currentUser.fullName} seed={currentUser.id} src={currentUser.avatarUrl} size="md" ring />
      <div className="flex flex-1 flex-col gap-2">
        <MentionTextarea
          rows={2}
          value={draft}
          members={members}
          maxLength={10_000}
          autoFocus
          aria-label="Write a reply"
          placeholder="Write a reply… (⌘/Ctrl + Enter to send)"
          onValueChange={setDraft}
          onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
        />
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={pending} disabled={!draft.trim()} onClick={() => void submit()}>
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ActivityPanel({
  taskId,
  projectId,
  currentUser,
  canComment,
  isAdmin,
  members,
}: {
  taskId: string;
  projectId: string;
  currentUser: UserRef;
  canComment: boolean;
  isAdmin: boolean;
  members: WorkspaceMember[];
}) {
  const [tab, setTab] = useState<Tab>('all');
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<{ rootId: string; prefill: string } | null>(null);
  const comments = useTaskComments(taskId);
  const activity = useTaskActivity(taskId);
  const actions = useCommentActions(taskId, projectId);

  // Thread satu tingkat: komentar akar terbaru dulu, balasan kronologis di bawah induknya.
  const allComments = comments.data?.items ?? [];
  const commentItems = allComments.filter((c) => !c.parentId).reverse();
  const repliesOf = (rootId: string) => allComments.filter((c) => c.parentId === rootId);
  const history = activity.data?.items ?? [];
  const systemItems = history.filter((a) => !a.action.startsWith('comment.'));

  /** Membalas sebuah balasan → mention penulisnya agar konteks jelas (balasan tetap di thread akar). */
  const startReply = (c: Comment) => {
    const author = c.parentId && c.author?.id !== currentUser.id ? members.find((m) => m.userId === c.author?.id) : undefined;
    setReplyTo({ rootId: c.parentId ?? c.id, prefill: author ? `@${handleOf(author.email)} ` : '' });
  };

  type Entry = { at: string; node: ReactNode };
  const commentItem = (c: Comment) => (
    <CommentItem
      key={c.id}
      comment={c}
      canEdit={c.author?.id === currentUser.id}
      canDelete={c.author?.id === currentUser.id || isAdmin}
      canInteract={canComment}
      onEdit={(body) => actions.edit.mutateAsync({ id: c.id, body })}
      onDelete={() => actions.remove.mutate(c.id)}
      onLike={(liked) => actions.like.mutate({ id: c.id, liked })}
      onReply={() => startReply(c)}
      members={members}
    />
  );
  const commentNode = (c: Comment) => {
    const replies = repliesOf(c.id);
    const composing = replyTo?.rootId === c.id;
    return (
      <div key={c.id} className="flex flex-col gap-3">
        {commentItem(c)}
        {(replies.length > 0 || composing) && (
          <div className="ml-4 flex flex-col gap-3 border-l-2 border-surface-container pl-space-md sm:ml-11">
            {replies.map(commentItem)}
            {composing && (
              <ReplyComposer
                key={replyTo.prefill}
                currentUser={currentUser}
                members={members}
                initial={replyTo.prefill}
                pending={actions.add.isPending}
                onCancel={() => setReplyTo(null)}
                onSubmit={async (body) => {
                  await actions.add.mutateAsync({ body, parentId: c.id });
                  setReplyTo(null);
                }}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  const entries: Entry[] =
    tab === 'comments'
      ? commentItems.map((c) => ({ at: c.createdAt, node: commentNode(c) }))
      : tab === 'history'
        ? history.map((a) => ({ at: a.createdAt, node: <SystemLine key={a.id} item={a} /> }))
        : [
            ...commentItems.map((c) => ({ at: c.createdAt, node: commentNode(c) })),
            ...systemItems.map((a) => ({ at: a.createdAt, node: <SystemLine key={a.id} item={a} /> })),
          ].sort((a, b) => b.at.localeCompare(a.at));

  const loading = comments.isLoading || activity.isLoading;
  const error = comments.error ?? activity.error;

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    await actions.add.mutateAsync({ body });
    setDraft('');
  };

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'all', label: 'All activity' },
    { id: 'comments', label: 'Comments', count: comments.data?.items.length },
    { id: 'history', label: 'History' },
  ];

  return (
    <section aria-label="Activity" className="flex flex-col gap-space-md pt-2">
      <div className="flex items-center justify-between border-b border-surface-container pb-1">
        <div role="tablist" aria-label="Activity filter" className="flex items-center gap-space-md text-label-md">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 pb-2 transition-colors',
                tab === t.id ? 'border-b-2 border-primary font-semibold text-primary' : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-container px-1 text-[10px] font-bold">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="flex items-center gap-1 text-[12px] text-outline">
          <Icon name="swap_vert" size={15} />
          Newest first
        </span>
      </div>

      {canComment && tab !== 'history' && (
        <div className="flex items-start gap-space-md rounded-xl bg-surface-container-low p-space-md shadow-xs">
          <Avatar name={currentUser.fullName} seed={currentUser.id} src={currentUser.avatarUrl} size="lg" ring />
          <div className="flex flex-1 flex-col gap-2">
            <MentionTextarea
              rows={2}
              value={draft}
              members={members}
              maxLength={10_000}
              aria-label="Write a comment"
              placeholder="Write a comment or type '@' to notify a collaborator… (⌘/Ctrl + Enter to send)"
              onValueChange={setDraft}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
            />
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] text-outline-variant">**bold** _italic_ `code` - list</span>
              <Button size="sm" variant="primary" className="px-4" loading={actions.add.isPending} disabled={!draft.trim()} onClick={() => void submit()}>
                Comment
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-space-md">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex gap-space-md">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-16 flex-1 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState compact error={error} onRetry={() => { comments.refetch(); activity.refetch(); }} title="Activity unavailable" />
      ) : entries.length === 0 ? (
        <EmptyState
          compact
          icon={tab === 'history' ? 'history' : 'forum'}
          title={tab === 'history' ? 'No history yet' : 'No comments yet'}
          description={tab === 'history' ? undefined : 'Start the discussion — ask a question or share progress.'}
        />
      ) : (
        <div className="flex flex-col gap-space-md">{entries.map((e) => e.node)}</div>
      )}
    </section>
  );
}
