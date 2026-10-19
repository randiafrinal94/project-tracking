import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(255));

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const registerSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(1).max(150),
});

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const updateProfileSchema = z
  .strictObject({
    fullName: z.string().trim().min(1).max(150).optional(),
    avatarUrl: z
      .url({ protocol: /^https$/, message: 'Avatar must be an https URL' })
      .max(2000)
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'At least one field is required');

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
