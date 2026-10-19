'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useId, useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Avatar } from '@/components/ui/avatar';
import { Pill } from '@/components/ui/badge';
import { Button, IconButton } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Field, Input, PasswordInput } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/segmented-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ui/states';
import { TagChip } from '@/components/ui/tag-chip';
import { useMembers, useTags, useWorkspaceDetail } from '@/hooks/queries';
import { useWorkspace } from '@/hooks/use-workspace';
import { api, ApiError, setAccessToken } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type { MemberRole, Me, Session, Tag, Workspace, WorkspaceMember } from '@/lib/types';
import { NoWorkspaceError, useAuth, useMe } from '@/providers/auth-provider';
import { useToast } from '@/providers/toast-provider';

type Tab = 'general' | 'members' | 'tags' | 'profile';
const TAG_COLORS = ['#4F46E5', '#2563EB', '#0EA5E9', '#059669', '#D97706', '#F97316', '#DC2626', '#64748B'];

const errorMap = (e: unknown) => {
  const out: Record<string, string> = {};
  if (e instanceof ApiError && Array.isArray(e.details)) for (const d of e.details as { path: string; message: string }[]) out[d.path] ??= d.message;
  return out;
};

/** Setelah keluar dari workspace terakhir sesi ditutup (AuthGate → /login); kembalikan null agar tidak redirect. */
const reloadMeOrSignedOut = (reloadMe: () => Promise<Me>) =>
  reloadMe().catch((e: unknown) => {
    if (e instanceof NoWorkspaceError) return null;
    throw e;
  });

// ---------------------------------------------------------------------------

function GeneralTab() {
  const id = useId();
  const workspace = useWorkspace();
  const detail = useWorkspaceDetail(workspace.id);
  const { reloadMe } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const canEdit = workspace.can('admin');

  useEffect(() => {
    if (detail.data) {
      setName(detail.data.name);
      setSlug(detail.data.slug);
    }
  }, [detail.data]);

  const save = useMutation({
    mutationFn: () => api<Workspace>(`/workspaces/${workspace.id}`, { method: 'PATCH', body: { name, slug } }),
    onSuccess: async (w) => {
      setErrors({});
      queryClient.setQueryData(qk.workspace(workspace.id), w);
      await reloadMe();
      toast({ tone: 'success', title: 'Workspace updated' });
      if (w.slug !== workspace.slug) router.replace(`/${w.slug}/settings`);
    },
    onError: (e) => {
      setErrors(e instanceof ApiError && e.code === 'SLUG_TAKEN' ? { slug: e.message } : errorMap(e));
      if (!(e instanceof ApiError && (e.code === 'SLUG_TAKEN' || e.code === 'VALIDATION_ERROR'))) toast({ tone: 'error', title: 'Could not save', description: (e as Error).message });
    },
  });

  const remove = useMutation({
    mutationFn: () => api(`/workspaces/${workspace.id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      const me = await reloadMeOrSignedOut(reloadMe);
      if (me) router.replace(me.workspaces[0] ? `/${me.workspaces[0].slug}` : '/onboarding');
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not delete workspace', description: (e as Error).message }),
  });

  if (detail.isLoading) return <Skeleton className="h-64 rounded-xl" />;
  if (detail.isError) return <Card><ErrorState error={detail.error} onRetry={() => detail.refetch()} /></Card>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };

  return (
    <div className="flex max-w-2xl flex-col gap-gutter">
      <Card>
        <CardHeader icon="tune" title="Workspace details" />
        <form onSubmit={submit} className="flex flex-col gap-space-md">
          <Field id={`${id}-name`} label="Name" error={errors.name}>
            <Input id={`${id}-name`} value={name} maxLength={150} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field id={`${id}-slug`} label="URL slug" error={errors.slug} hint={`Used in links: /${slug || 'your-workspace'}`}>
            <Input id={`${id}-slug`} value={slug} maxLength={150} disabled={!canEdit} className="font-mono" onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} />
          </Field>
          {canEdit ? (
            <div className="flex justify-end">
              <Button type="submit" variant="primary" loading={save.isPending} disabled={!name.trim() || slug.length < 3}>Save changes</Button>
            </div>
          ) : (
            <p className="text-body-sm text-on-surface-variant">Only admins can change workspace details.</p>
          )}
        </form>
      </Card>

      {workspace.can('owner') && (
        <Card className="ring-1 ring-error-container">
          <CardHeader icon="warning" iconTone="danger" title="Danger zone" />
          <p className="mb-space-md text-body-sm text-on-surface-variant">
            Deleting <strong>{workspace.name}</strong> permanently removes every project, task, comment and file in it. This cannot be undone.
          </p>
          <div className="flex flex-col gap-space-sm sm:flex-row sm:items-center">
            <Input aria-label="Type the workspace name to confirm" placeholder={`Type “${workspace.name}” to confirm`} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="flex-1" />
            <Button variant="destructive" icon="delete_forever" disabled={confirm !== workspace.name} loading={remove.isPending} onClick={() => remove.mutate()}>
              Delete workspace
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function MembersTab() {
  const id = useId();
  const workspace = useWorkspace();
  const { user } = useMe();
  const { reloadMe } = useAuth();
  const router = useRouter();
  const members = useMembers(workspace.id);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [error, setError] = useState<string | null>(null);
  const isOwner = workspace.can('owner');
  const isAdmin = workspace.can('admin');

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: qk.members(workspace.id) });
    queryClient.invalidateQueries({ queryKey: qk.workspace(workspace.id) });
  };
  const fail = (title: string) => (e: unknown) => toast({ tone: 'error', title, description: (e as Error).message });

  const add = useMutation({
    mutationFn: () => api<WorkspaceMember>(`/workspaces/${workspace.id}/members`, { method: 'POST', body: { email, role } }),
    onSuccess: (m) => {
      setEmail('');
      setError(null);
      refresh();
      toast({ tone: 'success', title: `${m.fullName} added`, description: `Role: ${m.role}` });
    },
    onError: (e) => setError(e instanceof ApiError ? (e.status === 404 ? 'No registered user with this email. Ask them to sign up first.' : e.message) : 'Could not add member'),
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, next }: { userId: string; next: MemberRole }) => api(`/workspaces/${workspace.id}/members/${userId}`, { method: 'PATCH', body: { role: next } }),
    onSuccess: refresh,
    onError: fail('Could not change role'),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api(`/workspaces/${workspace.id}/members/${userId}`, { method: 'DELETE' }),
    onSuccess: async (_r, userId) => {
      if (userId === user.id) {
        const me = await reloadMeOrSignedOut(reloadMe);
        if (me) router.replace(me.workspaces[0] ? `/${me.workspaces[0].slug}` : '/onboarding');
        return;
      }
      refresh();
    },
    onError: fail('Could not remove member'),
  });

  /** Aturan sama dengan API: owner permanen; admin hanya dikelola owner; tidak bisa mengubah diri sendiri. */
  const canManage = (m: WorkspaceMember) => m.role !== 'owner' && m.userId !== user.id && isAdmin && (isOwner || m.role !== 'admin');
  const roleOptions: MemberRole[] = isOwner ? ['admin', 'member', 'viewer'] : ['member', 'viewer'];

  return (
    <div className="flex max-w-3xl flex-col gap-gutter">
      {isAdmin && (
        <Card>
          <CardHeader icon="person_add" title="Add a member" />
          <form
            className="flex flex-col gap-space-sm sm:flex-row sm:items-start"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <div className="flex-1">
              <Input id={`${id}-email`} type="email" icon="mail" aria-label="Email" placeholder="teammate@company.com" value={email} aria-invalid={!!error || undefined} onChange={(e) => setEmail(e.target.value)} />
              {error && <p role="alert" className="mt-1 text-body-sm text-error">{error}</p>}
            </div>
            <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as MemberRole)} className="h-9 rounded-lg bg-surface-container-lowest px-2 text-body-sm capitalize text-on-surface shadow-xs">
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <Button type="submit" variant="primary" loading={add.isPending} disabled={!email.trim()}>Add</Button>
          </form>
        </Card>
      )}

      <Card className="p-0">
        <div className="px-space-lg pb-space-sm pt-space-lg">
          <h3 className="text-headline-sm text-on-surface">Members</h3>
          <p className="text-body-sm text-on-surface-variant">Owner · Admin manage the workspace · Member works on tasks · Viewer is read-only.</p>
        </div>
        {members.isLoading ? (
          <Skeleton className="m-space-lg h-40" />
        ) : (
          <ul className="divide-y divide-[#e2e8f0]">
            {(members.data ?? []).map((m) => (
              <li key={m.userId} className="flex flex-wrap items-center gap-space-md px-space-lg py-space-md">
                <Avatar name={m.fullName} seed={m.userId} src={m.avatarUrl} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label-md text-on-surface">
                    {m.fullName} {m.userId === user.id && <span className="text-outline">(you)</span>}
                  </p>
                  <p className="truncate text-[12px] text-on-surface-variant">{m.email}</p>
                </div>
                {canManage(m) ? (
                  <select
                    aria-label={`Role for ${m.fullName}`}
                    value={m.role}
                    onChange={(e) => changeRole.mutate({ userId: m.userId, next: e.target.value as MemberRole })}
                    className="h-8 rounded-lg bg-surface-container-low px-2 text-body-sm capitalize text-on-surface"
                  >
                    {[...new Set([m.role, ...roleOptions])].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <Pill tone={m.role === 'owner' ? 'primary' : 'neutral'} className="capitalize">{m.role}</Pill>
                )}
                {canManage(m) && (
                  <IconButton icon="person_remove" label={`Remove ${m.fullName}`} size="sm" onClick={() => remove.mutate(m.userId)} className="hover:bg-error-container hover:text-on-error-container" />
                )}
                {m.userId === user.id && m.role !== 'owner' && (
                  <Button size="sm" variant="ghost" icon="logout" onClick={() => remove.mutate(m.userId)}>Leave</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TagRow({ tag, canEdit }: { tag: Tag; canEdit: boolean }) {
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const dirty = name !== tag.name || color.toUpperCase() !== tag.color.toUpperCase();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: qk.tags(workspace.id) });
    queryClient.invalidateQueries({ queryKey: ['project'] });
  };
  const save = useMutation({
    mutationFn: () => api(`/tags/${tag.id}`, { method: 'PATCH', body: { name, color } }),
    onSuccess: () => {
      refresh();
      toast({ tone: 'success', title: 'Tag updated' });
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not update tag', description: (e as Error).message }),
  });
  const remove = useMutation({
    mutationFn: () => api(`/tags/${tag.id}`, { method: 'DELETE' }),
    onSuccess: refresh,
    onError: (e) => toast({ tone: 'error', title: 'Could not delete tag', description: (e as Error).message }),
  });

  return (
    <li className="flex flex-wrap items-center gap-space-md px-space-lg py-space-sm">
      {canEdit ? (
        <>
          <input type="color" aria-label={`Color for ${tag.name}`} value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent" />
          <Input inputSize="sm" aria-label="Tag name" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} className="w-48" />
        </>
      ) : (
        <span className="h-3 w-3 rounded-full" style={{ background: tag.color }} />
      )}
      <TagChip name={name || tag.name} color={color} />
      <span className="tabular flex-1 text-[12px] text-on-surface-variant">{tag.usageCount} task{tag.usageCount === 1 ? '' : 's'}</span>
      {canEdit && (
        <>
          <Button size="sm" variant="primary" disabled={!dirty || !name.trim()} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
          <IconButton icon="delete" label={`Delete ${tag.name}`} size="sm" onClick={() => remove.mutate()} className="hover:bg-error-container hover:text-on-error-container" />
        </>
      )}
    </li>
  );
}

function TagsTab() {
  const workspace = useWorkspace();
  const tags = useTags(workspace.id);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState('');
  const [color, setColor] = useState(TAG_COLORS[0]!);
  const create = useMutation({
    mutationFn: () => api<Tag>(`/workspaces/${workspace.id}/tags`, { method: 'POST', body: { name, color } }),
    onSuccess: () => {
      setName('');
      queryClient.invalidateQueries({ queryKey: qk.tags(workspace.id) });
    },
    onError: (e) => toast({ tone: 'error', title: 'Could not create tag', description: (e as Error).message }),
  });

  return (
    <div className="flex max-w-3xl flex-col gap-gutter">
      {workspace.can('member') && (
        <Card>
          <CardHeader icon="sell" title="New tag" />
          <form className="flex flex-wrap items-center gap-space-sm" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <Input inputSize="md" aria-label="Tag name" placeholder="e.g. Security" value={name} maxLength={50} onChange={(e) => setName(e.target.value)} className="w-56" />
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Tag color">
              {TAG_COLORS.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)} className="h-6 w-6 rounded-full ring-offset-2 aria-checked:ring-2 aria-checked:ring-on-surface" style={{ background: c }} />
              ))}
            </div>
            {name && <TagChip name={name} color={color} />}
            <Button type="submit" variant="primary" icon="add" loading={create.isPending} disabled={!name.trim()}>Create</Button>
          </form>
        </Card>
      )}
      <Card className="p-0">
        <div className="px-space-lg pb-space-sm pt-space-lg">
          <h3 className="text-headline-sm text-on-surface">Tags</h3>
          <p className="text-body-sm text-on-surface-variant">Shared by every project in this workspace. {workspace.can('admin') ? '' : 'Only admins can rename or delete tags.'}</p>
        </div>
        {tags.isLoading ? (
          <Skeleton className="m-space-lg h-32" />
        ) : (
          <ul className="divide-y divide-[#e2e8f0]">
            {(tags.data ?? []).map((t) => <TagRow key={`${t.id}-${t.name}-${t.color}`} tag={t} canEdit={workspace.can('admin')} />)}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProfileTab() {
  const id = useId();
  const { user } = useMe();
  const { reloadMe } = useAuth();
  const toast = useToast();
  const [fullName, setFullName] = useState(user.fullName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});

  const saveProfile = useMutation({
    mutationFn: () => api<Me>('/auth/me', { method: 'PATCH', body: { fullName, avatarUrl: avatarUrl.trim() || null } }),
    onSuccess: async () => {
      setProfileErrors({});
      await reloadMe();
      toast({ tone: 'success', title: 'Profile updated' });
    },
    onError: (e) => setProfileErrors(errorMap(e)),
  });
  const changePassword = useMutation({
    mutationFn: () => api<Session>('/auth/password', { method: 'POST', body: { currentPassword, newPassword } }),
    onSuccess: (session) => {
      setAccessToken(session.accessToken);
      setCurrent('');
      setNew('');
      setPwErrors({});
      toast({ tone: 'success', title: 'Password changed', description: 'Other devices were signed out.' });
    },
    onError: (e) => setPwErrors(errorMap(e)),
  });

  return (
    <div className="grid max-w-4xl items-start gap-gutter lg:grid-cols-2">
      <Card>
        <CardHeader icon="badge" title="Profile" />
        <form className="flex flex-col gap-space-md" onSubmit={(e) => { e.preventDefault(); saveProfile.mutate(); }}>
          <div className="flex items-center gap-space-md">
            <Avatar name={fullName || user.fullName} seed={user.id} src={avatarUrl || null} size="lg" />
            <div>
              <p className="text-label-md text-on-surface">{user.email}</p>
              <p className="text-[12px] text-on-surface-variant">Mention handle: <span className="font-mono">@{user.email.split('@')[0]}</span></p>
            </div>
          </div>
          <Field id={`${id}-name`} label="Full name" error={profileErrors.fullName}>
            <Input id={`${id}-name`} value={fullName} maxLength={150} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field id={`${id}-avatar`} label="Avatar URL" error={profileErrors.avatarUrl} hint="Optional https image URL.">
            <Input id={`${id}-avatar`} type="url" value={avatarUrl} placeholder="https://…" onChange={(e) => setAvatarUrl(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={saveProfile.isPending} disabled={!fullName.trim()}>Save profile</Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader icon="lock" title="Change password" />
        <form className="flex flex-col gap-space-md" onSubmit={(e) => { e.preventDefault(); changePassword.mutate(); }}>
          <Field id={`${id}-current`} label="Current password" error={pwErrors.currentPassword}>
            <PasswordInput id={`${id}-current`} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
          </Field>
          <Field id={`${id}-new`} label="New password" error={pwErrors.newPassword} hint="At least 8 characters with a letter and a number.">
            <PasswordInput id={`${id}-new`} autoComplete="new-password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={changePassword.isPending} disabled={!currentPassword || !newPassword}>Update password</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------

function SettingsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (['general', 'members', 'tags', 'profile'] as Tab[]).find((t) => t === params.get('tab')) ?? 'general';

  return (
    <div className="flex flex-col">
      <PageHeader icon="settings" title="Settings">
        <div className="overflow-x-auto no-scrollbar pt-space-xs">
          <SegmentedTabs
            label="Settings sections"
            active={tab}
            onChange={(id) => router.replace(`${pathname}?tab=${id}`, { scroll: false })}
            tabs={[
              { id: 'general', label: 'General', icon: 'tune' },
              { id: 'members', label: 'Members', icon: 'group' },
              { id: 'tags', label: 'Tags', icon: 'sell' },
              { id: 'profile', label: 'My profile', icon: 'person' },
            ]}
          />
        </div>
      </PageHeader>
      {tab === 'general' && <GeneralTab />}
      {tab === 'members' && <MembersTab />}
      {tab === 'tags' && <TagsTab />}
      {tab === 'profile' && <ProfileTab />}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  );
}
