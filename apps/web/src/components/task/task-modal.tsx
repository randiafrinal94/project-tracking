'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { PriorityBadge, priorityLabel, TASK_STATUS } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { ErrorState } from '@/components/ui/states';
import { STATUSES, useTask } from '@/hooks/board';
import { useMembers, useMilestones, useTags } from '@/hooks/queries';
import { useTaskActions } from '@/hooks/task';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import type { Project, TaskPriority, TaskStatus, UserRef } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';
import { ActivityPanel } from './activity-panel';
import { Attachments } from './attachments';
import { Checklist } from './checklist';
import { DescriptionEditor } from './description-editor';
import { MetaRail } from './meta-rail';

const PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

const PRIORITY_PILL: Record<TaskPriority, string> = {
  urgent: 'bg-error-container/60 text-on-error-container',
  high: 'bg-high-soft text-on-high-soft',
  medium: 'bg-surface-container text-on-surface-variant',
  low: 'bg-surface-container text-on-surface-variant',
};
const PRIORITY_DOT: Record<TaskPriority, string> = {
  urgent: 'bg-error',
  high: 'bg-high',
  medium: 'bg-review',
  low: 'bg-outline',
};

function ModalSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-space-md px-space-xl py-space-lg">
      <Skeleton className="h-5 w-64" />
      <div className="flex gap-2">
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-36 rounded-full" />
      </div>
      <Skeleton className="h-8 w-3/4" />
      <div className="grid gap-space-lg pt-space-md lg:grid-cols-12">
        <div className="flex flex-col gap-space-md lg:col-span-8">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="flex flex-col gap-space-md lg:col-span-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function TaskModal({
  taskId,
  project,
  canEdit,
  isAdmin,
  currentUser,
  onClose,
}: {
  taskId: string | null;
  project: Project;
  canEdit: boolean;
  isAdmin: boolean;
  currentUser: UserRef;
  onClose: () => void;
}) {
  const task = useTask(taskId);
  const members = useMembers(project.workspaceId);
  const milestones = useMilestones(project.id);
  const tags = useTags(project.workspaceId);
  const actions = useTaskActions(taskId ?? 'none', project.id, project.workspaceId);
  const toast = useToast();
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setEditingTitle(false);
    setConfirmDelete(false);
  }, [taskId]);

  const t = task.data;
  const saving =
    actions.update.isPending || actions.setStatus.isPending || actions.setTags.isPending ||
    actions.addSubtask.isPending || actions.updateSubtask.isPending || actions.removeSubtask.isPending;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ tone: 'success', title: 'Link copied', description: t ? `${t.key} link is on your clipboard.` : undefined });
    } catch {
      toast({ tone: 'error', title: 'Could not copy link' });
    }
  };

  const commitTitle = () => {
    const title = titleDraft.trim();
    if (t && title && title !== t.title) actions.update.mutate({ patch: { title } });
    setEditingTitle(false);
  };

  return (
    <Dialog.Root open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-inverse-surface/40 p-gutter backdrop-blur-[3px] md:p-gutter-lg">
          <Dialog.Content
            aria-describedby={undefined}
            className="relative my-4 flex w-full max-w-[1060px] flex-col overflow-hidden rounded-2xl bg-surface-container-lowest shadow-modal focus:outline-none"
          >
            {task.isLoading || !t ? (
              <>
                <Dialog.Title className="sr-only">Loading task</Dialog.Title>
                {task.isError ? (
                  <div className="p-space-xl">
                    <ErrorState error={task.error} onRetry={() => task.refetch()} title="Could not open task" />
                    <div className="flex justify-center">
                      <Button variant="ghost" onClick={onClose}>Close</Button>
                    </div>
                  </div>
                ) : (
                  <ModalSkeleton />
                )}
              </>
            ) : (
              <>
                {/* ===== Header ===== */}
                <div className="flex flex-col gap-space-md bg-surface-container-lowest px-space-lg pb-space-md pt-space-lg md:px-space-xl">
                  <div className="flex items-center justify-between gap-space-md">
                    <div className="flex flex-wrap items-center gap-space-sm text-label-md text-on-surface-variant">
                      <span className="flex items-center gap-1 text-body-sm">
                        <Icon name="folder" size={16} />
                        {project.name}
                      </span>
                      {t.milestone && (
                        <>
                          <span className="text-label-sm text-outline-variant">/</span>
                          <span className="text-body-sm">{t.milestone.name}</span>
                        </>
                      )}
                      <span className="text-label-sm text-outline-variant">/</span>
                      <button
                        type="button"
                        title="Click to copy ID"
                        onClick={async () => {
                          await navigator.clipboard.writeText(t.key).catch(() => undefined);
                          toast({ tone: 'info', title: `${t.key} copied` });
                        }}
                        className="flex items-center gap-1.5 rounded-md bg-surface-container px-2 py-0.5 font-mono text-code-inline text-on-surface transition-colors hover:bg-surface-container-high"
                      >
                        <span className="font-semibold text-primary">{t.key}</span>
                        <Icon name="content_copy" size={14} className="text-outline" />
                      </button>
                    </div>
                    <div className="flex items-center gap-space-xs">
                      <Button variant="ghost" size="sm" icon="share" className="text-label-sm" onClick={copyLink}>
                        <span className="hidden sm:inline">Share</span>
                      </Button>
                      {canEdit && (
                        <Dropdown>
                          <DropdownTrigger asChild>
                            <IconButton icon="more_horiz" label="More options" size="sm" />
                          </DropdownTrigger>
                          <DropdownContent align="end">
                            <DropdownItem icon="link" onSelect={copyLink}>Copy link</DropdownItem>
                            <DropdownSeparator />
                            <DropdownItem icon="delete" destructive onSelect={() => setConfirmDelete(true)}>
                              Delete task
                            </DropdownItem>
                          </DropdownContent>
                        </Dropdown>
                      )}
                      <div className="mx-1 h-4 w-px bg-surface-container-high" />
                      <Dialog.Close asChild>
                        <IconButton icon="close" label="Close" size="sm" iconSize={19} className="hover:bg-error-container hover:text-on-error-container" />
                      </Dialog.Close>
                    </div>
                  </div>

                  {confirmDelete && (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-space-sm rounded-lg bg-error-container/60 p-space-sm text-body-sm text-on-error-container">
                      <span className="flex items-center gap-2">
                        <Icon name="warning" size={18} /> Delete {t.key}? It will disappear from the board (admins can restore it).
                      </span>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          loading={actions.remove.isPending}
                          onClick={() => actions.remove.mutate(undefined, { onSuccess: onClose })}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-space-sm pt-space-xs">
                    <div className="flex flex-wrap items-center gap-space-sm">
                      {/* Status */}
                      <Dropdown>
                        <DropdownTrigger asChild disabled={!canEdit}>
                          <button
                            type="button"
                            aria-label={`Status: ${TASK_STATUS[t.status].label}`}
                            className={cn('flex h-7 items-center gap-2 rounded-full px-3 transition-colors', TASK_STATUS[t.status].pill)}
                          >
                            <span className={cn('h-2 w-2 rounded-full', TASK_STATUS[t.status].dot)} />
                            <span className="text-label-md font-semibold">{TASK_STATUS[t.status].label}</span>
                            {canEdit && <Icon name="expand_more" size={16} />}
                          </button>
                        </DropdownTrigger>
                        <DropdownContent>
                          <DropdownLabel>Move to</DropdownLabel>
                          {STATUSES.map((s: TaskStatus) => (
                            <DropdownItem key={s} active={s === t.status} onSelect={() => s !== t.status && actions.setStatus.mutate(s)}>
                              <span className="flex items-center gap-2">
                                <span className={cn('h-2 w-2 rounded-full', TASK_STATUS[s].dot)} />
                                {TASK_STATUS[s].label}
                              </span>
                            </DropdownItem>
                          ))}
                        </DropdownContent>
                      </Dropdown>

                      {/* Priority */}
                      <Dropdown>
                        <DropdownTrigger asChild disabled={!canEdit}>
                          <button
                            type="button"
                            aria-label={`Priority: ${priorityLabel(t.priority)}`}
                            className={cn('flex h-7 items-center gap-1.5 rounded-full px-3', PRIORITY_PILL[t.priority])}
                          >
                            <span className="relative flex h-2 w-2">
                              {t.priority === 'urgent' && (
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" />
                              )}
                              <span className={cn('relative inline-flex h-2 w-2 rounded-full', PRIORITY_DOT[t.priority])} />
                            </span>
                            <span className="text-label-sm tracking-wide uppercase">{priorityLabel(t.priority)} Priority</span>
                          </button>
                        </DropdownTrigger>
                        <DropdownContent>
                          <DropdownLabel>Priority</DropdownLabel>
                          {PRIORITIES.map((p) => (
                            <DropdownItem key={p} active={p === t.priority} onSelect={() => p !== t.priority && actions.update.mutate({ patch: { priority: p } })}>
                              <PriorityBadge priority={p} />
                            </DropdownItem>
                          ))}
                        </DropdownContent>
                      </Dropdown>

                      {t.estimateHours !== null && (
                        <span className="flex h-7 items-center gap-1.5 rounded-full bg-surface-container px-2.5 font-mono text-code-inline text-on-surface-variant">
                          <Icon name="schedule" size={15} className="text-tertiary" />
                          {t.estimateHours}h estimate
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div className="group flex items-start justify-between gap-space-sm pt-1">
                      {editingTitle ? (
                        <input
                          autoFocus
                          value={titleDraft}
                          maxLength={255}
                          aria-label="Task title"
                          onChange={(e) => setTitleDraft(e.target.value)}
                          onBlur={commitTitle}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitTitle();
                            if (e.key === 'Escape') {
                              e.stopPropagation();
                              setEditingTitle(false);
                            }
                          }}
                          className="flex-1 rounded-lg bg-surface-container-low px-2 text-headline-lg-mobile tracking-tight text-on-surface ring-2 ring-primary-container/20 focus:outline-none md:text-headline-lg"
                        />
                      ) : (
                        <Dialog.Title className="flex-1 text-headline-lg-mobile leading-tight tracking-tight text-on-surface md:text-headline-lg">
                          {t.title}
                        </Dialog.Title>
                      )}
                      {canEdit && !editingTitle && (
                        <button
                          type="button"
                          title="Edit Title"
                          aria-label="Edit title"
                          onClick={() => {
                            setTitleDraft(t.title);
                            setEditingTitle(true);
                          }}
                          className="rounded-lg p-1.5 text-outline opacity-0 transition-opacity hover:bg-surface-container hover:text-on-surface focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Icon name="edit" size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* ===== Body: 8 / 4 ===== */}
                <div className="grid min-h-[580px] grid-cols-1 bg-surface-container-lowest lg:grid-cols-12">
                  <div className="flex flex-col gap-gutter-md overflow-y-auto p-space-lg md:p-space-xl lg:col-span-8">
                    <DescriptionEditor
                      html={t.description}
                      editable={canEdit}
                      onSave={(description) => actions.update.mutate({ patch: { description } })}
                    />
                    <Checklist
                      items={t.checklist}
                      editable={canEdit}
                      onAdd={(title) => actions.addSubtask.mutate(title)}
                      onToggle={(id, isCompleted) => actions.updateSubtask.mutate({ id, isCompleted })}
                      onRename={(id, title) => actions.updateSubtask.mutate({ id, title })}
                      onRemove={(id) => actions.removeSubtask.mutate(id)}
                    />
                    <Attachments taskId={t.id} projectId={project.id} currentUser={currentUser} canUpload={canEdit} isAdmin={isAdmin} />
                    <ActivityPanel taskId={t.id} projectId={project.id} currentUser={currentUser} canComment={canEdit} isAdmin={isAdmin} members={members.data ?? []} />
                  </div>
                  <MetaRail
                    task={t}
                    editable={canEdit}
                    members={members.data ?? []}
                    milestones={milestones.data ?? []}
                    tags={tags.data ?? []}
                    onPatch={(patch, view) => actions.update.mutate({ patch, view })}
                    onSetTags={(tagIds, next) => actions.setTags.mutate({ tagIds, tags: next })}
                    onCreateTag={(name, color) => actions.createTag.mutateAsync({ name, color })}
                  />
                </div>

                {/* ===== Footer ===== */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-container bg-surface-container-low px-space-lg py-3 text-[12px] text-on-surface-variant md:px-space-xl">
                  <div className="flex flex-wrap items-center gap-space-md">
                    <span className="flex items-center gap-1" aria-live="polite">
                      {saving ? (
                        <>
                          <Spinner size={12} className="text-primary-container" /> Saving changes…
                        </>
                      ) : (
                        <>
                          <Icon name="cloud_done" size={15} className="text-tertiary-container" /> All changes saved automatically
                        </>
                      )}
                    </span>
                    <span className="text-outline-variant">•</span>
                    <span>
                      Created {timeAgo(t.createdAt)}
                      {t.reporter && ` by ${t.reporter.fullName}`}
                    </span>
                    {!canEdit && (
                      <>
                        <span className="text-outline-variant">•</span>
                        <span className="flex items-center gap-1"><Icon name="visibility" size={14} /> View only</span>
                      </>
                    )}
                  </div>
                  <kbd className="rounded bg-surface-container-lowest px-1.5 py-0.5 font-mono text-[11px] text-on-surface shadow-xs">ESC to close</kbd>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
