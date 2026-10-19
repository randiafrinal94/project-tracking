import type { MemberRole, Project } from '@pt/db';
import type { RequestIdVariables } from 'hono/request-id';

export interface AuthUser {
  id: string;
  email: string;
}

export interface Membership {
  workspaceId: string;
  role: MemberRole;
}

/** Konteks kepemilikan resource yang diturunkan oleh middleware akses. */
export interface Scope {
  workspaceId: string;
  projectId?: string;
  taskId?: string;
  /** ID resource dari route param (task/subtask/comment/milestone/tag). */
  resourceId?: string;
  /** Pembuat resource, bila relevan (mis. author komentar). */
  ownerId?: string | null;
}

export interface AppEnv {
  Variables: RequestIdVariables & {
    user: AuthUser;
    membership: Membership;
    project: Project;
    scope: Scope;
  };
}
