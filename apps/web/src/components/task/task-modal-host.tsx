'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { useProjects } from '@/hooks/queries';
import { useWorkspace } from '@/hooks/use-workspace';
import { useMe } from '@/providers/auth-provider';
import { TaskModal } from './task-modal';

/** `?task=<id>&taskProject=<projectId>` → buka modal detail task dari halaman lintas project. */
export function useTaskParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const open = useCallback(
    (task: { id: string; projectId: string } | null) => {
      const next = new URLSearchParams(params);
      if (task) {
        next.set('task', task.id);
        next.set('taskProject', task.projectId);
      } else {
        next.delete('task');
        next.delete('taskProject');
      }
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    },
    [params, pathname, router],
  );
  return { taskId: params.get('task'), projectId: params.get('taskProject'), open };
}

export function TaskModalHost() {
  const workspace = useWorkspace();
  const { user } = useMe();
  const projects = useProjects(workspace.id);
  const { taskId, projectId, open } = useTaskParam();
  const project = projects.data?.find((p) => p.id === projectId);
  if (!taskId || !project) return null;

  return (
    <TaskModal
      taskId={taskId}
      project={project}
      canEdit={workspace.can('member')}
      isAdmin={workspace.can('admin')}
      currentUser={{ id: user.id, fullName: user.fullName, avatarUrl: user.avatarUrl }}
      onClose={() => open(null)}
    />
  );
}
