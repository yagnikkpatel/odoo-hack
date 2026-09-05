import { z } from "zod";
import { ATTENDANCE_STATUSES } from "./attendance";

const timestamp = z.iso.datetime({ offset: true });
const editReason = z.string().trim().min(1).max(500);
const overtimeHours = z.coerce.number().min(0).max(24);

export const createAttendanceSchema = z
  .object({
    employeeId: z.uuid(),
    attendanceDate: z.iso.date(),
    checkIn: timestamp.optional(),
    checkOut: timestamp.optional(),
    overtimeHours: overtimeHours.default(0),
    status: z.enum(ATTENDANCE_STATUSES).optional(),
    editReason: editReason.optional(),
  })
  .refine((value) => value.checkIn !== undefined || value.checkOut === undefined, {
    message: "checkOut requires checkIn",
    path: ["checkOut"],
  })
  .refine(
    (value) =>
      value.checkIn === undefined ||
      value.checkOut === undefined ||
      value.checkOut > value.checkIn,
    {
      message: "checkOut must be after checkIn",
      path: ["checkOut"],
    },
  );

export const updateAttendanceSchema = z
  .object({
    checkIn: timestamp.nullable().optional(),
    checkOut: timestamp.nullable().optional(),
    status: z.enum(ATTENDANCE_STATUSES).optional(),
    overtimeHours: overtimeHours.optional(),
    editReason: editReason.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "at least one field must be provided",
  });

export const attendanceIdParamSchema = z.object({
  id: z.uuid(),
});

const dateRange = {
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
};

function isOrderedRange(value: { from?: string; to?: string }): boolean {
  return !value.from || !value.to || value.to >= value.from;
}

export const listAttendancesQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.enum(ATTENDANCE_STATUSES).optional(),
    employeeId: z.uuid().optional(),
    search: z.string().trim().min(1).max(120).optional(),
    ...dateRange,
  })
  .refine(isOrderedRange, {
    message: "to must be on or after from",
    path: ["to"],
  });

export const myAttendanceQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.enum(ATTENDANCE_STATUSES).optional(),
    ...dateRange,
  })
  .refine(isOrderedRange, {
    message: "to must be on or after from",
    path: ["to"],
  });

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type ListAttendancesQuery = z.infer<typeof listAttendancesQuerySchema>;
export type MyAttendanceQuery = z.infer<typeof myAttendanceQuerySchema>;

// Multer gives us strings. Do not coerce null, blanks, arrays or booleans into
// valid coordinates (in particular Number("") and Number(null) both equal 0).
const coordinate = (min: number, max: number) =>
  z.union([z.number(), z.string().trim().min(1)])
    .transform(Number)
    .pipe(z.number().finite().min(min).max(max));

export const clockProofSchema = z.object({
  latitude: coordinate(-90, 90),
  longitude: coordinate(-180, 180),
  accuracy: coordinate(0, 100_000).optional(),
});
