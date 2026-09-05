import { z } from "zod";
import {
  COMPUTATION_METHODS,
  EMPLOYMENT_TYPES,
  PAYRUN_STATUSES,
  RULE_CATEGORIES,
} from "./payroll";

const ruleCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z][A-Z0-9_]{0,31}$/,
    "code must start with a letter and use uppercase letters, digits and underscores",
  );

const money = z.coerce.number().min(0).max(9999999999.99);

export const createRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  code: ruleCode,
  category: z.enum(RULE_CATEGORIES),
  sequence: z.coerce.number().int().min(0).max(100000).default(10),
  method: z.enum(COMPUTATION_METHODS).default("fixed"),
  amount: money.default(0),
  percentage: z.coerce.number().min(0).max(1000).default(0),
  base: z.string().trim().max(500).default(""),
  formula: z.string().trim().max(2000).default(""),
  description: z.string().trim().max(500).default(""),
  active: z.boolean().default(true),
});

export const updateRuleSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    code: ruleCode.optional(),
    category: z.enum(RULE_CATEGORIES).optional(),
    sequence: z.coerce.number().int().min(0).max(100000).optional(),
    method: z.enum(COMPUTATION_METHODS).optional(),
    amount: money.optional(),
    percentage: z.coerce.number().min(0).max(1000).optional(),
    base: z.string().trim().max(500).optional(),
    formula: z.string().trim().max(2000).optional(),
    description: z.string().trim().max(500).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  });

export const createStructureSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  active: z.boolean().default(true),
  ruleIds: z.array(z.uuid()).max(200).default([]),
  /** Optional sequence overrides saved together with the structure. */
  sequences: z
    .array(z.object({ ruleId: z.uuid(), sequence: z.coerce.number().int().min(0) }))
    .max(200)
    .default([]),
});

export const updateStructureSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).optional(),
    active: z.boolean().optional(),
    ruleIds: z.array(z.uuid()).max(200).optional(),
    sequences: z
      .array(z.object({ ruleId: z.uuid(), sequence: z.coerce.number().int().min(0) }))
      .max(200)
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  });

export const payrollIdParamSchema = z.object({ id: z.uuid() });

export const employeeIdParamSchema = z.object({ employeeId: z.uuid() });

export const periodQuerySchema = z
  .object({
    structureId: z.uuid(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const createPayrunSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    structureId: z.uuid(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    employeeIds: z.array(z.uuid()).min(1).max(500),
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  })
  .refine((value) => new Set(value.employeeIds).size === value.employeeIds.length, {
    message: "employeeIds must be distinct",
    path: ["employeeIds"],
  });

export const listPayrunsQuerySchema = z.object({
  status: z.enum(PAYRUN_STATUSES).optional(),
  structureId: z.uuid().optional(),
});

export const listPayslipsQuerySchema = z.object({
  status: z.enum(PAYRUN_STATUSES).optional(),
  payrunId: z.uuid().optional(),
  employeeId: z.uuid().optional(),
});

export const sendPayslipsSchema = z.object({
  payslipIds: z.array(z.uuid()).max(500).optional(),
});

export const bankDetailsSchema = z.object({
  accountHolder: z.string().trim().max(120).default(""),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{9,18}$/, "accountNumber must be 9 to 18 digits"),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "ifsc must look like HDFC0001234"),
  bankName: z.string().trim().max(120).default(""),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^[A-Z]{5}[0-9]{4}[A-Z]$/, "pan must look like ABCDE1234F")
    .default(""),
  uan: z
    .string()
    .trim()
    .regex(/^$|^[0-9]{12}$/, "uan must be 12 digits")
    .default(""),
});

export const dashboardQuerySchema = z
  .object({
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    department: z.string().trim().max(120).optional(),
    employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  })
  .refine((value) => !value.from || !value.to || value.to >= value.from, {
    message: "to must be on or after from",
    path: ["to"],
  });

export type CreateRuleInput = z.infer<typeof createRuleSchema>;
export type UpdateRuleInput = z.infer<typeof updateRuleSchema>;
export type CreateStructureInput = z.infer<typeof createStructureSchema>;
export type UpdateStructureInput = z.infer<typeof updateStructureSchema>;
export type PeriodQuery = z.infer<typeof periodQuerySchema>;
export type CreatePayrunInput = z.infer<typeof createPayrunSchema>;
export type ListPayrunsQuery = z.infer<typeof listPayrunsQuerySchema>;
export type ListPayslipsQuery = z.infer<typeof listPayslipsQuerySchema>;
export type SendPayslipsInput = z.infer<typeof sendPayslipsSchema>;
export type BankDetailsInput = z.infer<typeof bankDetailsSchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
