import { z } from "zod";
import { CONTRACT_EMPLOYMENT_TYPES, CONTRACT_STATUSES } from "./contract";

export const createContractSchema = z
  .object({
    employeeId: z.uuid(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    wage: z.coerce.number().positive().max(9999999999.99),
    status: z.enum(CONTRACT_STATUSES).default("running"),
    salaryStructureId: z.uuid().nullable().default(null),
    employmentType: z.enum(CONTRACT_EMPLOYMENT_TYPES).default("full_time"),
  })
  .refine((value) => value.endDate > value.startDate, {
    message: "endDate must be after startDate",
    path: ["endDate"],
  });

export const updateContractSchema = z
  .object({
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    wage: z.coerce.number().positive().max(9999999999.99).optional(),
    status: z.enum(CONTRACT_STATUSES).optional(),
    salaryStructureId: z.uuid().nullable().optional(),
    employmentType: z.enum(CONTRACT_EMPLOYMENT_TYPES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  });

export const contractIdParamSchema = z.object({
  id: z.uuid(),
});

export const listContractsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(CONTRACT_STATUSES).optional(),
  employeeId: z.uuid().optional(),
  search: z.string().trim().min(1).max(120).optional(),
});

export type CreateContractInput = z.infer<typeof createContractSchema>;
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
export type ListContractsQuery = z.infer<typeof listContractsQuerySchema>;
