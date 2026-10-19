/** Kontrak respons API (lihat apps/api). */

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type ProjectStatus = 'planning' | 'active' | 'on_hold' | 'completed';
export type TaskStatus = 'backlog' | 'in_progress' | 'in_review' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: ApiErrorBody | null;
  timestamp: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  /** Jumlah total baris yang cocok (hanya endpoint task board). */
  total?: number;
  /** Paginasi offset (List view, sort ≠ board). */
  nextOffset?: number | null;
}

export type TaskSort = 'board' | 'due' | 'priority' | 'updated' | 'created' | 'title' | 'key';

export interface AppNotification {
  id: string;
  type: 'task.assigned' | 'comment.mention' | 'comment.created';
  projectId: string | null;
  taskId: string | null;
  metadata: { key?: string; title?: string; excerpt?: string; commentId?: string };
  readAt: string | null;
  createdAt: string;
  actor: UserRef | null;
}

export interface WorkspaceMilestone extends Milestone {
  project: { id: string; name: string; keyPrefix: string; status: ProjectStatus };
}

export interface WorkloadMember {
  user: UserRef & { email: string };
  role: MemberRole;
  openTasks: number;
  byStatus: { backlog: number; in_progress: number; in_review: number };
  overdue: number;
  openEstimateHours: number;
  weightedHours: number;
  loggedHours: number;
  completedThisWeek: number;
  loadPercent: number;
  label: 'Available' | 'Balanced' | 'Healthy' | 'High Load';
}

export interface Workload {
  capacityHours: number;
  defaultTaskHours: number;
  members: WorkloadMember[];
  unassigned: { openTasks: number; weightedHours: number };
}

export interface Report {
  weeks: number;
  weekly: { weekStart: string; created: number; completed: number; avgCycleDays: number | null }[];
  summary: { completed: number; created: number; avgPerWeek: number; avgCycleDays: number | null };
  byStatus: Record<TaskStatus, number>;
  openByPriority: Record<TaskPriority, number>;
  projects: {
    id: string;
    name: string;
    keyPrefix: string;
    total: number;
    done: number;
    overdue: number;
    completionRate: number;
    estimateHours: number;
    actualHours: number;
  }[];
}

export interface UserRef {
  id: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  /** Akun level owner: boleh membuat workspace baru. */
  canCreateWorkspace: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  user: User;
  accessToken: string;
  expiresIn: number;
}

export interface WorkspaceRef {
  id: string;
  name: string;
  slug: string;
  role: MemberRole;
}

export interface Me {
  user: User;
  workspaces: WorkspaceRef[];
}

export interface Workspace extends WorkspaceRef {
  ownerId: string;
  memberCount: number;
  projectCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: MemberRole;
  joinedAt: string;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionRate: number;
}

export interface Project {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  taskCounter: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  stats: ProjectStats;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  isCompleted: boolean;
  progress: { total: number; completed: number; percent: number };
}

export interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  color: string;
  usageCount: number;
}

export interface TaskCard {
  id: string;
  projectId: string;
  milestoneId: string | null;
  taskNumber: number;
  key: string;
  projectName: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  sortOrder: number;
  startDate: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  actualHours: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: UserRef | null;
  tags: Pick<Tag, 'id' | 'name' | 'color'>[];
  subtasks: { total: number; completed: number };
  commentCount: number;
  attachmentCount: number;
}

export interface ChecklistItem {
  id: string;
  title: string;
  isCompleted: boolean;
  completedAt: string | null;
  sortOrder: number;
}

export interface TaskDetail extends TaskCard {
  description: string | null;
  deletedAt: string | null;
  reporter: UserRef | null;
  milestone: { id: string; name: string } | null;
  checklist: ChecklistItem[];
}

export interface Comment {
  id: string;
  taskId: string;
  body: string;
  /** HTML yang sudah disanitasi server — aman dirender langsung. */
  bodyHtml: string;
  createdAt: string;
  updatedAt: string;
  author: UserRef | null;
  edited: boolean;
}

export interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  /** Gambar raster yang boleh ditampilkan inline (png/jpeg/gif/webp). */
  previewable: boolean;
  uploadedBy: UserRef | null;
}

export interface MoveResult {
  task: TaskDetail;
  rebalanced: boolean;
}

export interface TaskFilters {
  /** Hanya untuk daftar tingkat workspace. */
  projectId?: string;
  status?: TaskStatus;
  q?: string;
  assigneeId?: string;
  priority?: TaskPriority[];
  tagId?: string[];
  milestoneId?: string;
  overdue?: boolean;
}

export interface Dashboard {
  activeProjects: number;
  totalProjects: number;
  completedTasksThisWeek: number;
  completedTasksLastWeek: number;
  overdueItems: number;
  completionRate: number;
  tasksByStatus: Record<TaskStatus, number>;
  totalTasks: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  workspaceId: string;
  projectId: string | null;
  taskId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: UserRef | null;
  project: { id: string; name: string; keyPrefix: string } | null;
}
