/** Query key terpusat agar invalidasi cache konsisten. */
export const qk = {
  me: ['me'] as const,
  workspace: (workspaceId: string) => ['workspace', workspaceId] as const,
  members: (workspaceId: string) => ['workspace', workspaceId, 'members'] as const,
  projects: (workspaceId: string) => ['workspace', workspaceId, 'projects'] as const,
  dashboard: (workspaceId: string) => ['workspace', workspaceId, 'dashboard'] as const,
  workspaceActivity: (workspaceId: string) => ['workspace', workspaceId, 'activity'] as const,
  tags: (workspaceId: string) => ['workspace', workspaceId, 'tags'] as const,
  workspaceTasks: (workspaceId: string) => ['workspace', workspaceId, 'tasks'] as const,
  workspaceMilestones: (workspaceId: string) => ['workspace', workspaceId, 'milestones'] as const,
  workload: (workspaceId: string, projectId?: string) => ['workspace', workspaceId, 'workload', projectId ?? 'all'] as const,
  reports: (workspaceId: string, weeks: number, projectId?: string) =>
    ['workspace', workspaceId, 'reports', weeks, projectId ?? 'all'] as const,
  notifications: (workspaceId: string) => ['notifications', workspaceId] as const,
  projectList: (projectId: string) => ['project', projectId, 'tasks', 'list'] as const,
  project: (projectId: string) => ['project', projectId] as const,
  milestones: (projectId: string) => ['project', projectId, 'milestones'] as const,
  tasks: (projectId: string) => ['project', projectId, 'tasks'] as const,
  column: (projectId: string, status: string, filters: unknown) =>
    ['project', projectId, 'tasks', status, filters] as const,
  projectActivity: (projectId: string) => ['project', projectId, 'activity'] as const,
  task: (taskId: string) => ['task', taskId] as const,
  taskComments: (taskId: string) => ['task', taskId, 'comments'] as const,
  taskActivity: (taskId: string) => ['task', taskId, 'activity'] as const,
  attachments: (taskId: string) => ['task', taskId, 'attachments'] as const,
  attachmentBlob: (attachmentId: string) => ['attachment', attachmentId, 'blob'] as const,
};
