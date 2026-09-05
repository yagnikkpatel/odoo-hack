import { z } from "zod";
import { TIME_OFF_STATUSES, TIME_OFF_TYPES } from "./timeOff";

const reason = z.string().trim().min(1).max(500);
const decisionNote = z.string().trim().min(1).max(500);

function isOrderedDateRange(value: { startDate?: string; endDate?: string }): boolean {
  return !value.startDate || !value.endDate || value.endDate >= value.startDate;
}

export const createTimeOffRequestSchema = z
  .object({
    // Omitted by an employee filing for themselves; set only when HR files on
    // someone's behalf, which needs time_off:create:any.
    employeeId: z.uuid().optional(),
    timeOffType: z.enum(TIME_OFF_TYPES),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    reason,
  })
  .refine(isOrderedDateRange, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const updateTimeOffRequestSchema = z
  .object({
    timeOffType: z.enum(TIME_OFF_TYPES).optional(),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    reason: reason.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  })
  .refine(isOrderedDateRange, {
    message: "endDate must be on or after startDate",
    path: ["endDate"],
  });

export const approveTimeOffRequestSchema = z.object({
  decisionNote: decisionNote.optional(),
});

export const rejectTimeOffRequestSchema = z.object({
  decisionNote,
});

export const timeOffIdParamSchema = z.object({
  id: z.uuid(),
});

const dateRange = {
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};

function isOrderedRange(value: { from?: string; to?: string }): boolean {
  return !value.from || !value.to || value.to >= value.from;
}

export const listTimeOffRequestsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.enum(TIME_OFF_STATUSES).optional(),
    timeOffType: z.enum(TIME_OFF_TYPES).optional(),
    employeeId: z.uuid().optional(),
    search: z.string().trim().min(1).max(120).optional(),
    ...dateRange,
  })
  .refine(isOrderedRange, {
    message: "to must be on or after from",
    path: ["to"],
  });

export const myTimeOffRequestsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.enum(TIME_OFF_STATUSES).optional(),
    timeOffType: z.enum(TIME_OFF_TYPES).optional(),
    ...dateRange,
  })
  .refine(isOrderedRange, {
    message: "to must be on or after from",
    path: ["to"],
  });

export type CreateTimeOffRequestInput = z.infer<typeof createTimeOffRequestSchema>;
export type UpdateTimeOffRequestInput = z.infer<typeof updateTimeOffRequestSchema>;
export type ApproveTimeOffRequestInput = z.infer<typeof approveTimeOffRequestSchema>;
export type RejectTimeOffRequestInput = z.infer<typeof rejectTimeOffRequestSchema>;
export type ListTimeOffRequestsQuery = z.infer<typeof listTimeOffRequestsQuerySchema>;
export type MyTimeOffRequestsQuery = z.infer<typeof myTimeOffRequestsQuerySchema>;
