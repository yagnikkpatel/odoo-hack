import { z } from "zod";
import {
  COMPUTATION_METHODS,
  FORMULA_VARIABLES,
  PAYROLL_STATUSES,
  RULE_CATEGORIES,
} from "./payroll";

const RULE_CODE = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z][A-Z0-9_]{0,31}$/,
    "code must start with a letter and use uppercase letters, digits and underscores",
  )
  .refine(
    (code) => !FORMULA_VARIABLES.includes(code as (typeof FORMULA_VARIABLES)[number]),
    { message: "code is reserved for a payroll input" },
  );

const salaryRuleFields = {
  name: z.string().trim().min(1).max(100),
  code: RULE_CODE,
  category: z.enum(RULE_CATEGORIES),
  sequence: z.coerce.number().int().min(0).max(100000),
  method: z.enum(COMPUTATION_METHODS),
  amount: z.coerce.number().min(0).max(999999999999.99).default(0),
  percentage: z.coerce.number().min(0).max(1000).default(0),
  base: z.string().trim().max(500).default(""),
  formula: z.string().trim().max(500).default(""),
  quantity: z.coerce.number().min(0).max(10000).default(1),
  active: z.boolean().default(true),
};

/**
 * A rule is only calculable when the column its method reads is filled in, so
 * the requirement follows the method rather than the column.
 */
function requireMethodInput(
  value: {
    method?: string;
    percentage?: number;
    base?: string;
    formula?: string;
  },
  context: z.RefinementCtx,
): void {
  if (value.method === "percentage") {
    if (!value.base) {
      context.addIssue({
        code: "custom",
        path: ["base"],
        message: "a percentage rule needs a base such as WAGE or BASIC",
      });
    }

    if (!value.percentage) {
      context.addIssue({
        code: "custom",
        path: ["percentage"],
        message: "a percentage rule needs a percentage above 0",
      });
    }
  }

  if (value.method === "formula" && !value.formula) {
    context.addIssue({
      code: "custom",
      path: ["formula"],
      message: "a formula rule needs a formula",
    });
  }
}

export const createSalaryRuleSchema = z
  .object(salaryRuleFields)
  .superRefine(requireMethodInput);

export const updateSalaryRuleSchema = z
  .object({
    name: salaryRuleFields.name.optional(),
    code: RULE_CODE.optional(),
    category: salaryRuleFields.category.optional(),
    sequence: z.coerce.number().int().min(0).max(100000).optional(),
    method: salaryRuleFields.method.optional(),
    amount: z.coerce.number().min(0).max(999999999999.99).optional(),
    percentage: z.coerce.number().min(0).max(1000).optional(),
    base: z.string().trim().max(500).optional(),
    formula: z.string().trim().max(500).optional(),
    quantity: z.coerce.number().min(0).max(10000).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  });

export const listSalaryRulesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).max(120).optional(),
  category: z.enum(RULE_CATEGORIES).optional(),
  structureId: z.uuid().optional(),
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

/**
 * A structure carries its rules' execution order: saving one may renumber the
 * rules it includes, which is how the operator reorders a payslip.
 */
const structureRuleSequenceSchema = z.object({
  id: z.uuid(),
  sequence: z.coerce.number().int().min(0).max(100000),
});

export const createSalaryStructureSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).default(""),
  active: z.boolean().default(true),
  ruleIds: z.array(z.uuid()).min(1).max(200),
  ruleSequences: z.array(structureRuleSequenceSchema).max(200).default([]),
});

export const updateSalaryStructureSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    active: z.boolean().optional(),
    ruleIds: z.array(z.uuid()).min(1).max(200).optional(),
    ruleSequences: z.array(structureRuleSequenceSchema).max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  });

export const listSalaryStructuresQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).max(120).optional(),
  active: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

const payrollPeriod = {
  startDate: z.iso.date(),
  endDate: z.iso.date(),
};

function validPeriod(value: { startDate: string; endDate: string }): boolean {
  return (
    value.endDate >= value.startDate &&
    (Date.parse(value.endDate) - Date.parse(value.startDate)) / 86_400_000 <= 366
  );
}

const PERIOD_MESSAGE =
  "endDate must be on or after startDate, and the period cannot exceed one year";

export const createPayrunSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    structureId: z.uuid(),
    ...payrollPeriod,
    employeeIds: z.array(z.uuid()).min(1).max(500),
  })
  .refine(validPeriod, { message: PERIOD_MESSAGE, path: ["endDate"] });

export const updatePayrunSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    structureId: z.uuid(),
    ...payrollPeriod,
    employeeIds: z.array(z.uuid()).min(1).max(500),
  })
  .refine(validPeriod, { message: PERIOD_MESSAGE, path: ["endDate"] });

export const listPayrunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(PAYROLL_STATUSES).optional(),
  structureId: z.uuid().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const listPayslipsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().trim().min(1).max(120).optional(),
  status: z.enum(PAYROLL_STATUSES).optional(),
  payrunId: z.uuid().optional(),
  employeeId: z.uuid().optional(),
  department: z.string().trim().min(1).max(120).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

export const eligibleEmployeesQuerySchema = z
  .object({
    ...payrollPeriod,
    search: z.string().trim().min(1).max(120).optional(),
    department: z.string().trim().min(1).max(120).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .refine(validPeriod, { message: PERIOD_MESSAGE, path: ["endDate"] });

export const setBankAccountSchema = z.object({
  accountNumber: z.string().trim().min(4).max(64),
});

/**
 * Sending a payrun. Omitting payslipIds means every payslip in the payrun --
 * the "send all" case -- while recipients overrides the stored address for the
 * employees whose payslip carries a wrong or missing one.
 */
export const sendPayrunPayslipsSchema = z.object({
  payslipIds: z.array(z.uuid()).max(500).optional(),
  recipients: z
    .array(
      z.object({
        payslipId: z.uuid(),
        email: z.email().max(254),
      }),
    )
    .max(500)
    .optional(),
});

export const sendPayslipSchema = z.object({
  email: z.email().max(254).optional(),
});

export const payrollIdParamSchema = z.object({
  id: z.uuid(),
});

export const employeeIdParamSchema = z.object({
  employeeId: z.uuid(),
});

export type CreateSalaryRuleInput = z.infer<typeof createSalaryRuleSchema>;
export type UpdateSalaryRuleInput = z.infer<typeof updateSalaryRuleSchema>;
export type ListSalaryRulesQuery = z.infer<typeof listSalaryRulesQuerySchema>;
export type CreateSalaryStructureInput = z.infer<
  typeof createSalaryStructureSchema
>;
export type UpdateSalaryStructureInput = z.infer<
  typeof updateSalaryStructureSchema
>;
export type ListSalaryStructuresQuery = z.infer<
  typeof listSalaryStructuresQuerySchema
>;
export type CreatePayrunInput = z.infer<typeof createPayrunSchema>;
export type UpdatePayrunInput = z.infer<typeof updatePayrunSchema>;
export type ListPayrunsQuery = z.infer<typeof listPayrunsQuerySchema>;
export type ListPayslipsQuery = z.infer<typeof listPayslipsQuerySchema>;
export type EligibleEmployeesQuery = z.infer<
  typeof eligibleEmployeesQuerySchema
>;
export type SetBankAccountInput = z.infer<typeof setBankAccountSchema>;
export type SendPayrunPayslipsInput = z.infer<typeof sendPayrunPayslipsSchema>;
export type SendPayslipInput = z.infer<typeof sendPayslipSchema>;

/**
 * The dashboard reads one period at a time. department/jobPosition filter on
 * the payslip's own snapshot as well as the employee record, so a historical
 * payslip stays in its own department even after the employee moves.
 */
export const payrollDashboardQuerySchema = z
  .object({
    ...payrollPeriod,
    department: z.string().trim().min(1).max(120).optional(),
    jobPosition: z.string().trim().min(1).max(120).optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "currency must be a three letter code")
      .default("INR"),
  })
  .refine(validPeriod, { message: PERIOD_MESSAGE, path: ["endDate"] });

export type PayrollDashboardQuery = z.infer<typeof payrollDashboardQuerySchema>;
