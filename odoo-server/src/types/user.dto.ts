import { z } from "zod";

export const ASSIGNABLE_ROLES = [
  "employee",
  "hr_manager",
  "hr_payroll_user",
  "hr_payroll_manager",
] as const;

export const USER_STATUSES = ["active", "inactive"] as const;

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email().toLowerCase(),
  password: z.string().min(8).max(72),
  role: z.enum(ASSIGNABLE_ROLES),
  status: z.enum(USER_STATUSES).default("active"),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    email: z.email().toLowerCase().optional(),
    role: z.enum(ASSIGNABLE_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  });

export const userIdParamSchema = z.object({
  id: z.uuid(),
});

export const loginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
