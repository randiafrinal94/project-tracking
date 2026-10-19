import { z } from 'zod';
import { emailSchema } from '../auth/auth.schemas.js';

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(150)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Slug may only contain lowercase letters, numbers and dashes');

export const createWorkspaceSchema = z.strictObject({
  name: z.string().trim().min(1).max(150),
  slug: slugSchema.optional(),
});

export const updateWorkspaceSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(150).optional(),
    slug: slugSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');

/** Role `owner` hanya dimiliki pembuat workspace dan tidak bisa diberikan lewat API ini. */
const assignableRole = z.enum(['admin', 'member', 'viewer']);

export const addMemberSchema = z.strictObject({
  email: emailSchema,
  role: assignableRole.default('member'),
});

export const updateMemberSchema = z.strictObject({ role: assignableRole });

export const memberParamsSchema = z.object({
  workspaceId: z.uuid(),
  userId: z.uuid(),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type AssignableRole = z.infer<typeof assignableRole>;
