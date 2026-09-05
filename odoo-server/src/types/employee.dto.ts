import { z } from "zod";

const contactSchema = z
  .string()
  .trim()
  .min(7)
  .max(20)
  .regex(/^[0-9+()\-\s]+$/, "contact may contain digits and + - ( ) only");

export const createEmployeeProfileSchema = z.object({
  jobPosition: z.string().trim().min(1).max(120),
  department: z.string().trim().min(1).max(120),
  contact: contactSchema,
  managerId: z.uuid().optional(),
  workingSchedule: z.string().trim().min(1).max(60),
  companyName: z.string().trim().min(1).max(160),
  workLocation: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(160).optional(),
});

export const updateEmployeeProfileSchema = createEmployeeProfileSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  });

export const userIdParamSchema = z.object({
  userId: z.uuid(),
});

export type CreateEmployeeProfileInput = z.infer<
  typeof createEmployeeProfileSchema
>;
export type UpdateEmployeeProfileInput = z.infer<
  typeof updateEmployeeProfileSchema
>;

export const listEmployeesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  department: z.string().trim().min(1).max(120).optional(),
  role: z.string().trim().min(1).max(60).optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export type ListEmployeesQuery = z.infer<typeof listEmployeesQuerySchema>;

export const IMAGE_TYPES = ["employee", "company"] as const;

export const imageParamSchema = z.object({
  userId: z.uuid(),
  imageType: z.enum(IMAGE_TYPES),
});

export type ImageType = (typeof IMAGE_TYPES)[number];
