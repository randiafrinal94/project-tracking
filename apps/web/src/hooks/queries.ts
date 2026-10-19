'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { qk } from '@/lib/query-keys';
import type {
  ActivityItem,
  Dashboard,
  Milestone,
  Page,
  Project,
  Report,
  Tag,
  Workload,
  Workspace,
  WorkspaceMember,
  WorkspaceMilestone,
} from '@/lib/types';

export const useWorkspaceDetail = (workspaceId: string) =>
  useQuery({ queryKey: qk.workspace(workspaceId), queryFn: () => api<Workspace>(`/workspaces/${workspaceId}`) });

export const useProjects = (workspaceId: string) =>
  useQuery({
    queryKey: qk.projects(workspaceId),
    queryFn: () => api<Project[]>(`/workspaces/${workspaceId}/projects`),
  });

export const useDashboard = (workspaceId: string) =>
  useQuery({
    queryKey: qk.dashboard(workspaceId),
    queryFn: () => api<Dashboard>(`/workspaces/${workspaceId}/dashboard`),
  });

export const useMembers = (workspaceId: string) =>
  useQuery({
    queryKey: qk.members(workspaceId),
    queryFn: () => api<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`),
  });

export const useWorkspaceActivity = (workspaceId: string, limit = 8) =>
  useQuery({
    queryKey: [...qk.workspaceActivity(workspaceId), limit],
    queryFn: () => api<Page<ActivityItem>>(`/workspaces/${workspaceId}/activity`, { query: { limit } }),
    refetchInterval: 30_000,
  });

export const useTags = (workspaceId: string) =>
  useQuery({
    queryKey: qk.tags(workspaceId),
    queryFn: () => api<Tag[]>(`/workspaces/${workspaceId}/tags`),
  });

export const useProjectActivity = (projectId: string, limit = 8) =>
  useQuery({
    queryKey: [...qk.projectActivity(projectId), limit],
    queryFn: () => api<Page<ActivityItem>>(`/projects/${projectId}/activity`, { query: { limit } }),
    refetchInterval: 30_000,
  });

export const useWorkspaceMilestones = (workspaceId: string) =>
  useQuery({
    queryKey: qk.workspaceMilestones(workspaceId),
    queryFn: () => api<WorkspaceMilestone[]>(`/workspaces/${workspaceId}/milestones`),
  });

export const useWorkload = (workspaceId: string, projectId?: string) =>
  useQuery({
    queryKey: qk.workload(workspaceId, projectId),
    queryFn: () => api<Workload>(`/workspaces/${workspaceId}/workload`, { query: { projectId } }),
  });

export const useReports = (workspaceId: string, weeks: number, projectId?: string) =>
  useQuery({
    queryKey: qk.reports(workspaceId, weeks, projectId),
    queryFn: () => api<Report>(`/workspaces/${workspaceId}/reports`, { query: { weeks, projectId } }),
  });

export const useMilestones = (projectId: string) =>
  useQuery({
    queryKey: qk.milestones(projectId),
    queryFn: () => api<Milestone[]>(`/projects/${projectId}/milestones`),
  });
