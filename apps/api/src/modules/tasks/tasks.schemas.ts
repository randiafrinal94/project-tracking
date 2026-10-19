import { taskPriority, taskStatus } from '@pt/db';
import { z } from 'zod';
import { paginationQuery } from '../../lib/pagination.js';
import { nullableDate } from '../../lib/validate.js';

/** NUMERIC(5,2): 0 – 999.99 jam. */
const hours = z.number().min(0).max(999.99).multipleOf(0.01);

const dateRangeValid = (v: { startDate?: string | null; dueDate?: string | null }) =>
  !v.startDate || !v.dueDate || v.dueDate >= v.startDate;
const dateRangeIssue = { message: 'Due date must be on or after start date', path: ['dueDate'] };

const fields = {
  title: z.string().trim().min(1).max(255),
  /** HTML dari rich-text editor; disanitasi sebelum disimpan. */
  description: z.string().max(50_000).nullable(),
  priority: z.enum(taskPriority.enumValues),
  assigneeId: z.uuid().nullable(),
  milestoneId: z.uuid().nullable(),
  startDate: nullableDate,
  dueDate: nullableDate,
  estimateHours: hours.nullable(),
};

export const tagIdsSchema = z
  .array(z.uuid())
  .max(20)
  .transform((ids) => [...new Set(ids)]);

export const createTaskSchema = z
  .strictObject({
    title: fields.title,
    description: fields.description.optional(),
    status: z.enum(taskStatus.enumValues).default('backlog'),
    priority: fields.priority.default('medium'),
    assigneeId: fields.assigneeId.optional(),
    milestoneId: fields.milestoneId.optional(),
    startDate: fields.startDate.optional(),
    dueDate: fields.dueDate.optional(),
    estimateHours: fields.estimateHours.optional(),
    tagIds: tagIdsSchema.default([]),
  })
  .refine(dateRangeValid, dateRangeIssue);

/** Status & posisi diubah lewat `PATCH /tasks/:taskId/move`, bukan endpoint ini. */
export const updateTaskSchema = z
  .strictObject({
    title: fields.title.optional(),
    description: fields.description.optional(),
    priority: fields.priority.optional(),
    assigneeId: fields.assigneeId.optional(),
    milestoneId: fields.milestoneId.optional(),
    startDate: fields.startDate.optional(),
    dueDate: fields.dueDate.optional(),
    estimateHours: fields.estimateHours.optional(),
    actualHours: hours.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required')
  .refine(dateRangeValid, dateRangeIssue);

/**
 * Kartu ditempatkan tepat setelah `prevTaskId` atau tepat sebelum `nextTaskId`
 * di kolom `status`. Keduanya kosong → taruh di akhir kolom.
 */
export const moveTaskSchema = z.strictObject({
  status: z.enum(taskStatus.enumValues),
  prevTaskId: z.uuid().nullable().optional(),
  nextTaskId: z.uuid().nullable().optional(),
});

export const setTagsSchema = z.strictObject({ tagIds: tagIdsSchema });

/** Query `a,b,c` → `['a','b','c']`. */
const splitCsv = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean);

export const listTasksQuerySchema = z.object({
  status: z.enum(taskStatus.enumValues).optional(),
  priority: z
    .string()
    .transform(splitCsv)
    .pipe(z.array(z.enum(taskPriority.enumValues)).min(1))
    .optional(),
  assigneeId: z.union([z.uuid(), z.literal('me'), z.literal('unassigned')]).optional(),
  milestoneId: z.union([z.uuid(), z.literal('none')]).optional(),
  tagId: z.string().transform(splitCsv).pipe(z.array(z.uuid()).min(1).max(20)).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  overdue: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  /** Hanya untuk daftar tingkat workspace. */
  projectId: z.uuid().optional(),
  /**
   * `board` (default): status → sort_order, paginasi keyset (`cursor`).
   * Urutan lain (List view) memakai paginasi `offset`.
   */
  sort: z.enum(['board', 'due', 'priority', 'updated', 'created', 'title', 'key']).default('board'),
  dir: z.enum(['asc', 'desc']).default('asc'),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  ...paginationQuery(200, 500),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
