import { AppError } from "../errors/AppError";
import {
  bumpCacheVersion,
  getCacheVersion,
  getCached,
  invalidateCache,
  setCached,
} from "../lib/cache";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import {
  checkInEmployee,
  checkOutEmployee,
  deleteAttendanceById,
  findAllAttendances,
  findAttendanceById,
  findOpenAttendance,
  findTodayAttendance,
  getLocalToday,
  insertAbsentees,
  insertAttendance,
  updateAttendanceById,
} from "../repositories/attendance.repository";
import {
  CreateAttendanceInput,
  ListAttendancesQuery,
  MyAttendanceQuery,
  UpdateAttendanceInput,
} from "../types/attendance.dto";
import {
  AttendanceListResult,
  AttendanceRecord,
  AttendanceStatus,
  OPEN_SESSION_MAX_HOURS,
} from "../types/attendance";

const ATTENDANCE_LIST_NAMESPACE = "attendance-list";
const CHECK_IN_LOCK_TTL_SECONDS = 10;

function attendanceCacheKey(id: string): string {
  return `attendance:${id}`;
}

function todayCacheKey(employeeId: string, date: string): string {
  return `attendance:today:${employeeId}:${date}`;
}

function checkInLockKey(employeeId: string): string {
  return `attendance:lock:check-in:${employeeId}`;
}

function attendanceListCacheKey(
  version: number,
  query: ListAttendancesQuery & { employeeId?: string },
): string {
  const parts = [
    `limit=${query.limit}`,
    `offset=${query.offset}`,
    `status=${query.status ?? ""}`,
    `employeeId=${query.employeeId ?? ""}`,
    `from=${query.from ?? ""}`,
    `to=${query.to ?? ""}`,
    `search=${query.search ?? ""}`,
  ];

  return `${ATTENDANCE_LIST_NAMESPACE}:v${version}:${parts.join("&")}`;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { code?: string }).code;
}

function getErrorConstraint(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { constraint?: string }).constraint;
}

function toDomainError(error: unknown): AppError | null {
  const code = getErrorCode(error);
  const constraint = getErrorConstraint(error);

  if (code === "23503") {
    return new AppError(404, "Employee not found");
  }

  if (code === "23505") {
    return new AppError(
      409,
      "This employee already has an attendance record for that date",
    );
  }

  if (code === "23514") {
    if (constraint === "attendances_time_order_check") {
      return new AppError(400, "checkOut must be after checkIn");
    }

    if (constraint === "attendances_checkout_requires_checkin_check") {
      return new AppError(400, "checkOut requires checkIn");
    }

    if (constraint === "attendances_overtime_check") {
      return new AppError(400, "overtimeHours must be between 0 and 24");
    }

    if (constraint === "attendances_status_check") {
      return new AppError(400, "Invalid attendance status");
    }

    return new AppError(400, "Attendance violates a database constraint");
  }

  return null;
}

async function invalidateAttendanceCaches(
  attendance: Pick<AttendanceRecord, "id" | "employeeId" | "attendanceDate">,
): Promise<void> {
  await invalidateCache([
    attendanceCacheKey(attendance.id),
    todayCacheKey(attendance.employeeId, attendance.attendanceDate),
  ]);
  await bumpCacheVersion(ATTENDANCE_LIST_NAMESPACE);
}

/**
 * Status follows the timestamps unless a manager states otherwise:
 * both times -> present, check-in only -> incomplete, neither -> absent.
 */
function deriveStatus(
  checkIn: unknown | null,
  checkOut: unknown | null,
): AttendanceStatus {
  if (checkIn && checkOut) {
    return "present";
  }

  if (checkIn) {
    return "incomplete";
  }

  return "absent";
}

function assertNotFuture(value: string | null | undefined, field: string): void {
  if (value && new Date(value).getTime() > Date.now()) {
    throw new AppError(400, `${field} cannot be in the future`);
  }
}

function assertSaneDuration(
  checkIn: string | Date | null | undefined,
  checkOut: string | Date | null | undefined,
): void {
  if (!checkIn || !checkOut) {
    return;
  }

  const durationHours =
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3_600_000;

  if (durationHours <= 0) {
    throw new AppError(400, "checkOut must be after checkIn");
  }

  if (durationHours > OPEN_SESSION_MAX_HOURS) {
    throw new AppError(
      400,
      `A single attendance record cannot exceed ${OPEN_SESSION_MAX_HOURS} hours`,
    );
  }
}

export async function checkIn(employeeId: string): Promise<AttendanceRecord> {
  const lockKey = checkInLockKey(employeeId);
  let lockAcquired = false;

  try {
    lockAcquired =
      (await redis.set(lockKey, "1", "EX", CHECK_IN_LOCK_TTL_SECONDS, "NX")) ===
      "OK";
  } catch (error) {
    logger.warn({ err: error, employeeId }, "check-in lock unavailable");
  }

  try {
    const attendance = await checkInEmployee(employeeId);

    if (!attendance) {
      throw new AppError(409, "You have already checked in today");
    }

    await invalidateAttendanceCaches(attendance);

    return attendance;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  } finally {
    if (lockAcquired) {
      await redis.del(lockKey).catch(() => undefined);
    }
  }
}

export async function checkOut(employeeId: string): Promise<AttendanceRecord> {
  const open = await findOpenAttendance(employeeId);

  if (!open) {
    const today = await findTodayAttendance(employeeId);

    if (today?.checkOut) {
      throw new AppError(409, "You have already checked out today");
    }

    throw new AppError(404, "No open check-in found, check in first");
  }

  const attendance = await checkOutEmployee(employeeId);

  if (!attendance) {
    throw new AppError(409, "You have already checked out");
  }

  await invalidateAttendanceCaches(attendance);

  return attendance;
}

export async function getMyTodayAttendance(
  employeeId: string,
): Promise<AttendanceRecord | null> {
  const today = await getLocalToday();
  const cacheKey = todayCacheKey(employeeId, today);
  const cached = await getCached<AttendanceRecord | null>(cacheKey);

  if (cached) {
    return cached;
  }

  const attendance = await findTodayAttendance(employeeId);

  if (attendance) {
    await setCached(cacheKey, attendance);
  }

  return attendance;
}

export async function listMyAttendances(
  employeeId: string,
  query: MyAttendanceQuery,
): Promise<AttendanceListResult> {
  return listAttendances({ ...query, employeeId });
}

export async function createAttendance(
  input: CreateAttendanceInput,
): Promise<AttendanceRecord> {
  assertNotFuture(input.checkIn, "checkIn");
  assertNotFuture(input.checkOut, "checkOut");
  assertSaneDuration(input.checkIn, input.checkOut);

  const status = input.status ?? deriveStatus(input.checkIn, input.checkOut);

  try {
    const attendance = await insertAttendance({ ...input, status });

    await invalidateAttendanceCaches(attendance);

    return attendance;
  } catch (error) {
    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function listAttendances(
  query: ListAttendancesQuery,
): Promise<AttendanceListResult> {
  const version = await getCacheVersion(ATTENDANCE_LIST_NAMESPACE);
  const cacheKey = attendanceListCacheKey(version, query);
  const cached = await getCached<AttendanceListResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const { rows, total } = await findAllAttendances(query);

  const result: AttendanceListResult = {
    attendances: rows,
    pagination: {
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + rows.length < total,
    },
  };

  await setCached(cacheKey, result);

  return result;
}

export async function getAttendance(id: string): Promise<AttendanceRecord> {
  const cacheKey = attendanceCacheKey(id);
  const cached = await getCached<AttendanceRecord>(cacheKey);

  if (cached) {
    return cached;
  }

  const attendance = await findAttendanceById(id);

  if (!attendance) {
    throw new AppError(404, "Attendance record not found");
  }

  await setCached(cacheKey, attendance);

  return attendance;
}

export async function updateAttendance(
  id: string,
  input: UpdateAttendanceInput,
  actorId: string,
): Promise<AttendanceRecord> {
  const existing = await findAttendanceById(id);

  if (!existing) {
    throw new AppError(404, "Attendance record not found");
  }

  assertNotFuture(input.checkIn, "checkIn");
  assertNotFuture(input.checkOut, "checkOut");

  const nextCheckIn =
    input.checkIn !== undefined ? input.checkIn : existing.checkIn;
  const nextCheckOut =
    input.checkOut !== undefined ? input.checkOut : existing.checkOut;

  assertSaneDuration(nextCheckIn, nextCheckOut);

  const timesTouched =
    input.checkIn !== undefined || input.checkOut !== undefined;

  // An explicit status always wins; otherwise only re-derive when the manager
  // actually moved a timestamp, so editing overtime alone never flips status.
  const status =
    input.status ??
    (timesTouched ? deriveStatus(nextCheckIn, nextCheckOut) : undefined);

  try {
    const attendance = await updateAttendanceById(
      id,
      { ...input, status },
      actorId,
    );

    if (!attendance) {
      throw new AppError(404, "Attendance record not found");
    }

    await invalidateAttendanceCaches(existing);
    await invalidateAttendanceCaches(attendance);

    return attendance;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function removeAttendance(id: string): Promise<string> {
  const existing = await findAttendanceById(id);

  if (!existing) {
    throw new AppError(404, "Attendance record not found");
  }

  const deletedId = await deleteAttendanceById(id);

  if (!deletedId) {
    throw new AppError(404, "Attendance record not found");
  }

  await invalidateAttendanceCaches(existing);

  return deletedId;
}

export async function markAbsentees(attendanceDate: string): Promise<number> {
  const inserted = await insertAbsentees(attendanceDate);

  if (inserted.length > 0) {
    await bumpCacheVersion(ATTENDANCE_LIST_NAMESPACE);
  }

  return inserted.length;
}
