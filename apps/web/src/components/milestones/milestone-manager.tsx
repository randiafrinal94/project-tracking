'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { Pill } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from '@/components/ui/dropdown';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/states';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { daysFromToday, longDate } from '@/lib/format';
import type { Milestone } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';

function dueTone(m: Milestone) {
  if (m.isCompleted) return { label: 'Completed', tone: 'success' as const };
  if (!m.dueDate) return { label: 'No due date', tone: 'strong' as const };
  const d = daysFromToday(m.dueDate);
  if (d < 0) return { label: `${-d}d overdue`, tone: 'danger' as const };
  if (d === 0) return { label: 'Due today', tone: 'danger' as const };
  return { label: `${d} day${d === 1 ? '' : 's'} left`, tone: d <= 3 ? ('primary' as const) : ('strong' as const) };
}

/** Daftar milestone dengan aksi admin (buat, selesai/buka lagi, hapus). */
export function MilestoneManager({
  milestones,
  projectId,
  canManage,
  invalidateKeys,
  subtitle,
}: {
  milestones: Milestone[];
  /** Project tujuan untuk milestone baru (tanpa ini form tidak ditampilkan). */
  projectId?: string;
  canManage: boolean;
  invalidateKeys: readonly (readonly unknown[])[];
  subtitle?: (m: Milestone) => string | undefined;
}) {
  const id = useId();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [dueDate, setDueDate] = useState('');

  const refresh = () => invalidateKeys.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
  const fail = (title: string) => (e: unknown) => toast({ tone: 'error', title, description: (e as Error).message });

  const create = useMutation({
    mutationFn: () => api<Milestone>(`/projects/${projectId}/milestones`, { method: 'POST', body: { name, dueDate: dueDate || null } }),
    onSuccess: () => {
      setName('');
      setDueDate('');
      setAdding(false);
      refresh();
      toast({ tone: 'success', title: 'Milestone created' });
    },
    onError: fail('Could not create milestone'),
  });
  const toggle = useMutation({
    mutationFn: (m: Milestone) => api(`/milestones/${m.id}`, { method: 'PATCH', body: { completed: !m.isCompleted } }),
    onSuccess: refresh,
    onError: fail('Could not update milestone'),
  });
  const remove = useMutation({
    mutationFn: (m: Milestone) => api(`/milestones/${m.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      refresh();
      toast({ tone: 'success', title: 'Milestone deleted', description: 'Its tasks were kept and detached.' });
    },
    onError: fail('Could not delete milestone'),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };

  return (
    <div className="flex flex-col gap-space-md">
      {milestones.length === 0 && !adding && (
        <EmptyState compact icon="flag" title="No milestones" description="Milestones group tasks into phases or sprints." />
      )}
      {milestones.map((m) => {
        const due = dueTone(m);
        const tone = m.isCompleted ? 'success' : due.tone === 'danger' ? 'danger' : m.progress.percent >= 50 ? 'primary' : 'warning';
        return (
          <div key={m.id} className={cn('rounded-lg bg-surface-container-low p-space-md transition-colors hover:bg-surface-container', m.isCompleted && 'opacity-80')}>
            <div className="mb-1.5 flex items-center justify-between gap-space-sm">
              <div className="flex min-w-0 items-center gap-2">
                <Icon name={m.isCompleted ? 'check_circle' : 'flag'} size={18} className={m.isCompleted ? 'text-tertiary-container' : 'text-primary'} />
                <span className={cn('truncate text-label-md font-semibold text-on-surface', m.isCompleted && 'line-through')}>{m.name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Pill tone={due.tone} className="text-[11px] font-bold">{due.label}</Pill>
                {canManage && (
                  <Dropdown>
                    <DropdownTrigger asChild>
                      <IconButton icon="more_horiz" label={`Options for ${m.name}`} size="sm" className="h-7 w-7" />
                    </DropdownTrigger>
                    <DropdownContent align="end">
                      <DropdownItem icon={m.isCompleted ? 'undo' : 'task_alt'} onSelect={() => toggle.mutate(m)}>
                        {m.isCompleted ? 'Reopen milestone' : 'Mark as completed'}
                      </DropdownItem>
                      <DropdownSeparator />
                      <DropdownItem icon="delete" destructive onSelect={() => remove.mutate(m)}>
                        Delete milestone
                      </DropdownItem>
                    </DropdownContent>
                  </Dropdown>
                )}
              </div>
            </div>
            {(m.description || subtitle?.(m)) && (
              <p className="mb-space-sm line-clamp-2 text-body-sm text-on-surface-variant">{m.description ?? subtitle?.(m)}</p>
            )}
            <ProgressBar value={m.progress.percent} tone={tone} className="mb-1" label={`${m.name} progress`} />
            <div className="flex justify-between text-[11px] font-semibold tracking-[0.04em] text-outline">
              <span className="tabular">
                {m.progress.percent}% complete · {m.progress.completed}/{m.progress.total} tasks
              </span>
              {m.dueDate && <span>Due {longDate(m.dueDate)}</span>}
            </div>
          </div>
        );
      })}

      {canManage && projectId &&
        (adding ? (
          <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg bg-surface-container-lowest p-space-sm shadow-xs sm:flex-row sm:items-center">
            <Input id={`${id}-name`} autoFocus inputSize="sm" aria-label="Milestone name" placeholder="Milestone name" value={name} maxLength={150} onChange={(e) => setName(e.target.value)} className="flex-1" />
            <Input id={`${id}-due`} type="date" inputSize="sm" aria-label="Due date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="sm:w-40" />
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
              <Button size="sm" variant="primary" type="submit" loading={create.isPending} disabled={!name.trim()}>Add</Button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="flex w-fit items-center gap-2 rounded-lg px-2 py-1 text-label-md text-primary hover:bg-primary-fixed/20">
            <Icon name="add" size={18} /> New milestone
          </button>
        ))}
    </div>
  );
}
