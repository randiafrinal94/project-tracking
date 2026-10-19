'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { api, ApiError } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { Project, WorkspaceRef } from '@/lib/types';
import { useToast } from '@/providers/toast-provider';

const suggestPrefix = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .replace(/^[0-9]+/, '')
    .slice(0, 4);

export function CreateProjectDialog({
  workspace,
  open,
  onOpenChange,
}: {
  workspace: WorkspaceRef;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const id = useId();
  const router = useRouter();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [keyPrefix, setKeyPrefix] = useState('');
  const [prefixTouched, setPrefixTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const reset = () => {
    setName('');
    setKeyPrefix('');
    setPrefixTouched(false);
    setDescription('');
    setStartDate('');
    setTargetDate('');
    setErrors({});
  };

  const create = useMutation({
    mutationFn: () =>
      api<Project>(`/workspaces/${workspace.id}/projects`, {
        method: 'POST',
        body: {
          name,
          keyPrefix,
          description: description || null,
          startDate: startDate || null,
          targetDate: targetDate || null,
        },
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: qk.projects(workspace.id) });
      queryClient.invalidateQueries({ queryKey: qk.dashboard(workspace.id) });
      toast({ tone: 'success', title: 'Project created', description: `${project.name} (${project.keyPrefix})` });
      reset();
      onOpenChange(false);
      router.push(`/${workspace.slug}/projects/${project.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && Array.isArray(error.details)) {
        const next: Record<string, string> = {};
        for (const d of error.details as { path: string; message: string }[]) next[d.path] = d.message;
        setErrors(next);
      } else if (error instanceof ApiError && error.code === 'KEY_PREFIX_TAKEN') {
        setErrors({ keyPrefix: error.message });
      } else {
        toast({ tone: 'error', title: 'Could not create project', description: (error as Error).message });
      }
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setErrors({});
    create.mutate();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="New project"
      description={`Create a project in ${workspace.name}. Task keys will use the prefix, e.g. ${keyPrefix || 'PRJ'}-1.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={`${id}-form`} loading={create.isPending} icon="add">
            Create project
          </Button>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={submit} className="flex flex-col gap-space-md" noValidate>
        <Field id={`${id}-name`} label="Project name" error={errors.name}>
          <Input
            id={`${id}-name`}
            required
            autoFocus
            maxLength={150}
            value={name}
            aria-invalid={!!errors.name || undefined}
            placeholder="e.g. Mobile App Revamp"
            onChange={(e) => {
              setName(e.target.value);
              if (!prefixTouched) setKeyPrefix(suggestPrefix(e.target.value));
            }}
          />
        </Field>
        <Field id={`${id}-prefix`} label="Key prefix" error={errors.keyPrefix} hint="2–10 uppercase letters/digits. Cannot be changed later.">
          <Input
            id={`${id}-prefix`}
            required
            maxLength={10}
            value={keyPrefix}
            aria-invalid={!!errors.keyPrefix || undefined}
            className="max-w-[180px] font-mono"
            placeholder="PRJ"
            onChange={(e) => {
              setPrefixTouched(true);
              setKeyPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
            }}
          />
        </Field>
        <Field id={`${id}-desc`} label="Description" error={errors.description}>
          <Textarea id={`${id}-desc`} rows={3} maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-space-md sm:grid-cols-2">
          <Field id={`${id}-start`} label="Start date" error={errors.startDate}>
            <Input id={`${id}-start`} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id={`${id}-target`} label="Target date" error={errors.targetDate}>
            <Input
              id={`${id}-target`}
              type="date"
              value={targetDate}
              min={startDate || undefined}
              aria-invalid={!!errors.targetDate || undefined}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}
