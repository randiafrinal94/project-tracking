import { projectStatus } from '@pt/db';
import { z } from 'zod';
import { nullableDate } from '../../lib/validate.js';

const dateRangeValid = (v: { startDate?: string | null; targetDate?: string | null }) =>
  !v.startDate || !v.targetDate || v.targetDate >= v.startDate;
const dateRangeIssue = { message: 'Target date must be on or after start date', path: ['targetDate'] };

const fields = {
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(5000).nullable(),
  status: z.enum(projectStatus.enumValues),
  startDate: nullableDate,
  targetDate: nullableDate,
};

export const createProjectSchema = z
  .strictObject({
    name: fields.name,
    keyPrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Key prefix must be 2-10 uppercase letters/digits, starting with a letter'),
    description: fields.description.optional(),
    status: fields.status.default('planning'),
    startDate: fields.startDate.optional(),
    targetDate: fields.targetDate.optional(),
  })
  .refine(dateRangeValid, dateRangeIssue);

/** `keyPrefix` sengaja tidak bisa diubah agar key task (PRJ-42) tetap stabil. */
export const updateProjectSchema = z
  .strictObject({
    name: fields.name.optional(),
    description: fields.description.optional(),
    status: fields.status.optional(),
    startDate: fields.startDate.optional(),
    targetDate: fields.targetDate.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required')
  .refine(dateRangeValid, dateRangeIssue);

export const listProjectsQuerySchema = z.object({
  status: z.enum(projectStatus.enumValues).optional(),
  archived: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
});

export const restoreParamsSchema = z.object({ workspaceId: z.uuid(), projectId: z.uuid() });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
