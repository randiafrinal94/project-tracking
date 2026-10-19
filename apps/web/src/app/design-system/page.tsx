'use client';

import type { ReactNode } from 'react';
import { ActivityFeed } from '@/components/activity/activity-feed';
import { MilestoneItem } from '@/components/milestones/milestone-item';
import { Avatar, AvatarStack } from '@/components/ui/avatar';
import { CountBadge, Pill, PriorityBadge, ProjectStatusBadge, StatusBadge, TASK_STATUS } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { KpiCard, KpiTrend } from '@/components/ui/kpi-card';
import { ProgressBar } from '@/components/ui/progress';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { TagChip } from '@/components/ui/tag-chip';
import { ApiError } from '@/lib/api';
import type { ActivityItem, Milestone, TaskPriority, TaskStatus } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';

const COLORS: [string, string][] = [
  ['primary-container', '#4f46e5'], ['primary', '#3525cd'], ['primary-fixed', '#e2dfff'],
  ['secondary', '#006591'], ['secondary-fixed', '#c9e6ff'], ['tertiary-container', '#006e4b'],
  ['tertiary-fixed', '#6ffbbe'], ['error', '#ba1a1a'], ['error-container', '#ffdad6'],
  ['review', '#f59e0b'], ['high', '#f97316'], ['surface', '#f8f9ff'],
  ['surface-container-low', '#eff4ff'], ['surface-container', '#e5eeff'], ['surface-container-high', '#dce9ff'],
  ['on-surface', '#0b1c30'], ['on-surface-variant', '#464555'], ['outline', '#777587'],
];

const TYPE: [string, string][] = [
  ['text-headline-xl', 'Headline XL · 32/40 · 700'],
  ['text-headline-lg', 'Headline LG · 24/32 · 600'],
  ['text-headline-md', 'Headline MD · 18/26 · 600'],
  ['text-headline-sm', 'Headline SM · 15/22 · 600'],
  ['text-body-lg', 'Body LG · 16/24'],
  ['text-body-md', 'Body MD · 14/20'],
  ['text-body-sm', 'Body SM · 13/18'],
  ['text-label-md', 'Label MD · 13/18 · 500'],
  ['text-label-sm uppercase', 'Label SM · 11/16 · 600 · +0.04em'],
  ['font-mono text-code-inline', 'PRJ-4892 · code-inline · JetBrains Mono'],
];

const DEMO_ACTIVITY: ActivityItem[] = [
  { id: '1', action: 'task.moved', entityType: 'task', entityId: 'x', workspaceId: 'w', projectId: 'p', taskId: 't', metadata: { key: 'PRJ-7', to: 'in_review' }, createdAt: new Date(Date.now() - 12 * 60_000).toISOString(), actor: { id: 'a', fullName: 'Demo User', avatarUrl: null }, project: null },
  { id: '2', action: 'subtask.completed', entityType: 'subtask', entityId: 'x', workspaceId: 'w', projectId: 'p', taskId: 't', metadata: { key: 'PRJ-9', title: 'Write spec' }, createdAt: new Date(Date.now() - 45 * 60_000).toISOString(), actor: { id: 'b', fullName: 'Sample Person', avatarUrl: null }, project: null },
  { id: '3', action: 'comment.created', entityType: 'comment', entityId: 'x', workspaceId: 'w', projectId: 'p', taskId: 't', metadata: { key: 'PRJ-3' }, createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(), actor: { id: 'c', fullName: 'Example Member', avatarUrl: null }, project: null },
];

const DEMO_MILESTONE: Milestone = {
  id: 'm', projectId: 'p', name: 'Beta release (sample)', description: 'Example milestone rendering', startDate: null,
  dueDate: new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10), completedAt: null, sortOrder: 0,
  isCompleted: false, progress: { total: 8, completed: 7, percent: 88 },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-space-md">
      <h2 className="text-label-sm tracking-wider text-on-surface-variant uppercase">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const toast = useToast();

  return (
    <main className="min-h-screen bg-surface px-gutter py-space-xl md:px-margin-lg">
      <div className="mx-auto flex max-w-6xl flex-col gap-space-xl">
        <header>
          <h1 className="text-headline-xl tracking-tight text-on-surface">Kinetic Slate</h1>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Komponen UI Project Tracker — token dari Google Stitch. Data di halaman ini hanya contoh tampilan.
          </p>
        </header>

        <Section title="Color tokens">
          <div className="grid grid-cols-2 gap-space-sm sm:grid-cols-3 lg:grid-cols-6">
            {COLORS.map(([name, hex]) => (
              <div key={name} className="overflow-hidden rounded-lg bg-surface-container-lowest shadow-xs">
                <div className="h-12" style={{ backgroundColor: hex }} />
                <div className="p-2">
                  <p className="truncate text-label-sm text-on-surface">{name}</p>
                  <p className="font-mono text-[11px] text-outline">{hex}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <Card className="flex flex-col gap-space-sm">
            {TYPE.map(([cls, label]) => (
              <p key={cls} className={`${cls} text-on-surface`}>
                {label}
              </p>
            ))}
          </Card>
        </Section>

        <Section title="Buttons">
          <Card className="flex flex-col gap-space-md">
            <div className="flex flex-wrap items-center gap-space-sm">
              <Button variant="primary" icon="add">New</Button>
              <Button icon="share">Share</Button>
              <Button icon="tune">Filter</Button>
              <Button trailingIcon="arrow_drop_down" icon="view_column">Group: Status</Button>
              <Button variant="tonal" icon="file_download">Export</Button>
              <Button variant="ghost" icon="settings">Ghost</Button>
              <Button variant="destructive" icon="delete">Delete</Button>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary">Medium</Button>
              <Button variant="primary" size="lg">Large</Button>
              <Button variant="primary" loading>Saving</Button>
              <Button disabled>Disabled</Button>
              <IconButton icon="notifications" label="Notifications" dot />
              <IconButton icon="help_outline" label="Help" />
              <IconButton icon="more_horiz" label="More" size="sm" />
            </div>
          </Card>
        </Section>

        <Section title="Badges, pills & tags">
          <Card className="flex flex-col gap-space-md">
            <div className="flex flex-wrap items-center gap-space-sm">
              {(['urgent', 'high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                <PriorityBadge key={p} priority={p} />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              {(Object.keys(TASK_STATUS) as TaskStatus[]).map((s) => (
                <StatusBadge key={s} status={s} />
              ))}
              <ProjectStatusBadge status="active" />
              <ProjectStatusBadge status="planning" />
              <ProjectStatusBadge status="on_hold" />
              <ProjectStatusBadge status="completed" />
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <Pill>4 stages</Pill>
              <Pill tone="primary">3 days left</Pill>
              <Pill tone="danger">Immediate Action</Pill>
              <Pill tone="success" icon="check">Resolved</Pill>
              <CountBadge value={6} />
              <CountBadge value={8} className={TASK_STATUS.in_progress.count} />
              <Kbd>⌘K</Kbd>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm">
              <TagChip name="Frontend" color="#4F46E5" />
              <TagChip name="Backend" color="#2563EB" />
              <TagChip name="Design" color="#D97706" />
              <TagChip name="DevOps" color="#059669" />
              <TagChip name="Bug" color="#DC2626" />
              <TagChip name="Neutral" />
              <TagChip name="Pill shape" color="#4F46E5" shape="pill" />
            </div>
          </Card>
        </Section>

        <Section title="Avatars & progress">
          <Card className="flex flex-col gap-space-md">
            <div className="flex items-center gap-space-md">
              <Avatar name="Alya Pratama" size="xs" />
              <Avatar name="Bima Santoso" size="sm" />
              <Avatar name="Citra Lestari" size="md" status="online" />
              <Avatar name="Dimas Wirawan" size="lg" status="busy" />
              <AvatarStack
                people={['Ana Kim', 'Sam Jo', 'Eli Rae', 'Max Lee', 'Ivy Fox'].map((n, i) => ({ id: String(i), fullName: n }))}
              />
            </div>
            <div className="grid gap-space-sm sm:grid-cols-2">
              <ProgressBar value={33} label="primary" />
              <ProgressBar value={80} tone="info" label="info" />
              <ProgressBar value={100} tone="success" label="success" />
              <ProgressBar value={45} tone="warning" size="md" label="warning" />
            </div>
          </Card>
        </Section>

        <Section title="Inputs & tabs">
          <Card className="grid gap-space-md md:grid-cols-2">
            <Input icon="search" shortcut="⌘K" placeholder="Search tasks, projects, docs..." aria-label="Search demo" />
            <Input icon="search" inputSize="sm" placeholder="Filter tasks..." aria-label="Filter demo" />
            <Field id="ds-err" label="With error" error="Key prefix is already used in this workspace">
              <Input id="ds-err" defaultValue="PRJ" aria-invalid />
            </Field>
            <Field id="ds-dis" label="Disabled" hint="Cannot be changed later.">
              <Input id="ds-dis" defaultValue="CORE" disabled />
            </Field>
            <Textarea rows={2} placeholder="Write a comment or type '@' to notify a collaborator..." aria-label="Comment demo" />
            <div className="overflow-x-auto">
              <SegmentedTabs
                label="Views demo"
                active="kanban"
                tabs={[
                  { id: 'overview', label: 'Overview' },
                  { id: 'kanban', label: 'Kanban Board', icon: 'view_kanban', count: 24 },
                  { id: 'gantt', label: 'Gantt Timeline', icon: 'waterfall_chart' },
                  { id: 'list', label: 'List View', icon: 'list_alt' },
                ]}
              />
            </div>
          </Card>
        </Section>

        <Section title="KPI cards">
          <div className="grid gap-gutter sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Active Projects" icon="folder_copy" value={12} aside={<span className="text-label-sm text-on-surface-variant">of 14 total</span>} description="Example description" />
            <KpiCard
              label="Tasks Completed"
              icon="task_alt"
              iconTone="success"
              value={38}
              aside={<KpiTrend value={14} suffix="% vs lw" />}
              footer={<ProgressBar size="md" tone="success" value={73} label="demo" />}
            />
            <KpiCard label="Overdue Items" icon="warning" iconTone="danger" value={3} valueClassName="text-error" aside={<Pill tone="danger">Immediate Action</Pill>} />
            <KpiCard label="Loading state" icon="timer" iconTone="primary" value={0} loading />
          </div>
        </Section>

        <Section title="Rail panels">
          <div className="grid gap-gutter md:grid-cols-2">
            <Card>
              <CardHeader icon="flag" title="Upcoming Milestones" aside={<Pill className="rounded">Sample</Pill>} />
              <MilestoneItem milestone={DEMO_MILESTONE} />
            </Card>
            <Card>
              <CardHeader icon="bolt" iconTone="info" title="Live Activity" />
              <ActivityFeed items={DEMO_ACTIVITY} />
            </Card>
          </div>
        </Section>

        <Section title="Loading, empty & error states">
          <div className="grid gap-gutter md:grid-cols-3">
            <Card className="flex flex-col gap-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex items-center gap-2 pt-2 text-body-sm text-on-surface-variant">
                <Spinner size={14} /> Loading…
              </div>
            </Card>
            <Card className="p-0">
              <EmptyState compact icon="inbox" title="No tasks yet" description="Create a task to get started." action={<Button size="sm" variant="primary" icon="add">Quick task</Button>} />
            </Card>
            <Card className="p-0">
              <ErrorState compact error={new ApiError(500, 'INTERNAL_ERROR', 'An unexpected error occurred')} onRetry={() => undefined} />
            </Card>
          </div>
        </Section>

        <Section title="Toasts">
          <Card className="flex flex-wrap gap-space-sm">
            <Button icon="check_circle" onClick={() => toast({ tone: 'success', title: 'Task moved', description: 'PRJ-7 → In Review' })}>Success</Button>
            <Button icon="error" onClick={() => toast({ tone: 'error', title: 'Could not move task', description: 'Changes were rolled back.' })}>Error</Button>
            <Button icon="info" onClick={() => toast({ tone: 'info', title: 'Board refreshed' })}>Info</Button>
          </Card>
        </Section>

        <footer className="flex items-center gap-1 pb-space-xl text-body-sm text-outline">
          <Icon name="palette" size={16} /> Source: Google Stitch project “Project Management Dashboard Interface”.
        </footer>
      </div>
    </main>
  );
}
