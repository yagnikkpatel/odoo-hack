import { z } from "zod";
import {
  APPROVAL_POLICIES,
  LEAVE_UNITS,
  PAYROLL_TREATMENTS,
} from "./time-off";

const typeName = z.string().trim().min(1).max(100);

// Accepts either case on the wire; the service uppercases before it hits the
// database, whose CHECK constraint only allows the uppercase form.
const typeCode = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9_-]{1,16}$/,
    "code must be 1-16 letters, numbers, hyphens or underscores",
  );

const description = z.string().trim().max(2000);
const note = z.string().trim().max(2000);
const requestReason = z.string().trim().min(1).max(2000);
const amount = z.coerce.number().gt(0).max(100000);

/** '' is the open-ended sentinel; the column is nullable. */
const openEndedDate = z.union([z.literal(""), z.iso.date()]);

/** '' for the days unit, 'HH:MM' for the hours unit. */
const clockTime = z.union([
  z.literal(""),
  z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:MM"),
]);

function hasAtLeastOneField(value: object): boolean {
  return Object.keys(value).length > 0;
}

const AT_LEAST_ONE_FIELD = {
  message: "at least one field must be provided",
} as const;

export const createTypeSchema = z.object({
  name: typeName,
  code: typeCode,
  unit: z.enum(LEAVE_UNITS),
  requiresAllocation: z.boolean(),
  approval: z.enum(APPROVAL_POLICIES),
  payroll: z.enum(PAYROLL_TREATMENTS),
  active: z.boolean(),
  description: description.default(""),
});

export const updateTypeSchema = z
  .object({
    name: typeName.optional(),
    code: typeCode.optional(),
    unit: z.enum(LEAVE_UNITS).optional(),
    requiresAllocation: z.boolean().optional(),
    approval: z.enum(APPROVAL_POLICIES).optional(),
    payroll: z.enum(PAYROLL_TREATMENTS).optional(),
    active: z.boolean().optional(),
    description: description.optional(),
  })
  .refine(hasAtLeastOneField, AT_LEAST_ONE_FIELD);

export const createAllocationSchema = z
  .object({
    employeeId: z.uuid(),
    typeId: z.uuid(),
    amount,
    validFrom: z.iso.date(),
    validTo: openEndedDate.default(""),
    note: note.default(""),
  })
  .refine((value) => !value.validTo || value.validTo >= value.validFrom, {
    message: "validTo must be on or after validFrom",
    path: ["validTo"],
  });

export const updateAllocationSchema = z
  .object({
    employeeId: z.uuid().optional(),
    typeId: z.uuid().optional(),
    amount: amount.optional(),
    validFrom: z.iso.date().optional(),
    validTo: openEndedDate.optional(),
    note: note.optional(),
  })
  .refine(hasAtLeastOneField, AT_LEAST_ONE_FIELD);

// duration, charges, consumptions, status and history are never accepted from
// the client: the service derives them from the schedule and the allocations.
export const createRequestSchema = z
  .object({
    employeeId: z.uuid(),
    typeId: z.uuid(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    startTime: clockTime.default(""),
    endTime: clockTime.default(""),
    reason: requestReason,
  })
  .refine((value) => value.endDate >= value.startDate, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const updateRequestSchema = z
  .object({
    employeeId: z.uuid().optional(),
    typeId: z.uuid().optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    startTime: clockTime.optional(),
    endTime: clockTime.optional(),
    reason: requestReason.optional(),
  })
  .refine(hasAtLeastOneField, AT_LEAST_ONE_FIELD);

export const decisionSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export const idParamSchema = z.object({
  id: z.uuid(),
});

export type CreateTypeInput = z.infer<typeof createTypeSchema>;
export type UpdateTypeInput = z.infer<typeof updateTypeSchema>;
export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type UpdateAllocationInput = z.infer<typeof updateAllocationSchema>;
export type CreateRequestInput = z.infer<typeof createRequestSchema>;
export type UpdateRequestInput = z.infer<typeof updateRequestSchema>;
export type DecisionInput = z.infer<typeof decisionSchema>;
