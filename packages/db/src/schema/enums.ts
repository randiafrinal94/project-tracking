import { pgEnum } from 'drizzle-orm/pg-core';

export const memberRole = pgEnum('member_role', ['owner', 'admin', 'member', 'viewer']);

export const projectStatus = pgEnum('project_status', [
  'planning',
  'active',
  'on_hold',
  'completed',
]);

export const taskStatus = pgEnum('task_status', ['backlog', 'in_progress', 'in_review', 'done']);

export const taskPriority = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);

export type MemberRole = (typeof memberRole.enumValues)[number];
export type ProjectStatus = (typeof projectStatus.enumValues)[number];
export type TaskStatus = (typeof taskStatus.enumValues)[number];
export type TaskPriority = (typeof taskPriority.enumValues)[number];
