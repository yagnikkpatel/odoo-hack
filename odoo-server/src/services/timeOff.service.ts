import { AppError } from "../errors/AppError";
import {
  bumpCacheVersion,
  getCacheVersion,
  getCached,
  invalidateCache,
  setCached,
} from "../lib/cache";
import {
  decideTimeOffRequest,
  deleteTimeOffRequestById,
  findAllTimeOffRequests,
  findTimeOffRequestById,
  insertTimeOffRequest,
  updateTimeOffRequestById,
} from "../repositories/timeOff.repository";
import { getRolePermissions } from "./permission.service";
import {
  ApproveTimeOffRequestInput,
  CreateTimeOffRequestInput,
  ListTimeOffRequestsQuery,
  MyTimeOffRequestsQuery,
  RejectTimeOffRequestInput,
  UpdateTimeOffRequestInput,
} from "../types/timeOff.dto";
import {
  MAX_TIME_OFF_DAYS,
  TimeOffListResult,
  TimeOffRequestRecord,
} from "../types/timeOff";
import { TokenPayload } from "../types/user";

const TIME_OFF_LIST_NAMESPACE = "timeoff-list";

function timeOffCacheKey(id: string): string {
  return `timeoff:${id}`;
}

function timeOffListCacheKey(
  version: number,
  query: ListTimeOffRequestsQuery,
): string {
  const parts = [
    `limit=${query.limit}`,
    `offset=${query.offset}`,
    `status=${query.status ?? ""}`,
    `type=${query.timeOffType ?? ""}`,
    `employeeId=${query.employeeId ?? ""}`,
    `from=${query.from ?? ""}`,
    `to=${query.to ?? ""}`,
    `search=${query.search ?? ""}`,
  ];

  return `${TIME_OFF_LIST_NAMESPACE}:v${version}:${parts.join("&")}`;
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

  // exclusion_violation: the no-overlap constraint fired.
  if (code === "23P01") {
    return new AppError(
      409,
      "This employee already has a time off request covering those dates",
    );
  }

  if (code === "23514") {
    if (constraint === "time_off_requests_date_order_check") {
      return new AppError(400, "endDate must be on or after startDate");
    }

    if (constraint === "time_off_requests_type_check") {
      return new AppError(400, "Invalid time off type");
    }

    if (constraint === "time_off_requests_status_check") {
      return new AppError(400, "Invalid time off status");
    }

    if (constraint === "time_off_requests_approver_not_self") {
      return new AppError(403, "You cannot approve your own time off request");
    }

    return new AppError(400, "Time off request violates a database constraint");
  }

  return null;
}

async function invalidateTimeOffCaches(id: string): Promise<void> {
  await invalidateCache([timeOffCacheKey(id)]);
  await bumpCacheVersion(TIME_OFF_LIST_NAMESPACE);
}

function assertSaneDuration(startDate: string, endDate: string): void {
  const days =
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86_400_000 +
    1;

  if (days > MAX_TIME_OFF_DAYS) {
    throw new AppError(
      400,
      `A single time off request cannot exceed ${MAX_TIME_OFF_DAYS} days`,
    );
  }
}

async function hasPermission(
  actor: TokenPayload,
  code: string,
): Promise<boolean> {
  const permissions = await getRolePermissions(actor.role);

  return permissions.has(code);
}

/**
 * Employees file for themselves; only `time_off:create:any` may name someone
 * else, so an employee cannot book leave against a colleague's balance.
 */
export async function createTimeOffRequest(
  input: CreateTimeOffRequestInput,
  actor: TokenPayload,
): Promise<TimeOffRequestRecord> {
  const employeeId = input.employeeId ?? actor.userId;

  if (
    employeeId !== actor.userId &&
    !(await hasPermission(actor, "time_off:create:any"))
  ) {
    throw new AppError(
      403,
      "Missing required permission: time_off:create:any to file for another employee",
    );
  }

  if (
    employeeId === actor.userId &&
    !(await hasPermission(actor, "time_off:create:own")) &&
    !(await hasPermission(actor, "time_off:create:any"))
  ) {
    throw new AppError(403, "Missing required permission: time_off:create:own");
  }

  assertSaneDuration(input.startDate, input.endDate);

  try {
    const request = await insertTimeOffRequest({
      employeeId,
      timeOffType: input.timeOffType,
      startDate: input.startDate,
      endDate: input.endDate,
      reason: input.reason,
    });

    await invalidateTimeOffCaches(request.id);

    return request;
  } catch (error) {
    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function listTimeOffRequests(
  query: ListTimeOffRequestsQuery,
): Promise<TimeOffListResult> {
  const version = await getCacheVersion(TIME_OFF_LIST_NAMESPACE);
  const cacheKey = timeOffListCacheKey(version, query);
  const cached = await getCached<TimeOffListResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const { rows, total } = await findAllTimeOffRequests(query);

  const result: TimeOffListResult = {
    requests: rows,
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

export async function listMyTimeOffRequests(
  employeeId: string,
  query: MyTimeOffRequestsQuery,
): Promise<TimeOffListResult> {
  return listTimeOffRequests({ ...query, employeeId });
}

export async function getTimeOffRequest(
  id: string,
  actor: TokenPayload,
): Promise<TimeOffRequestRecord> {
  const cacheKey = timeOffCacheKey(id);
  let request = await getCached<TimeOffRequestRecord>(cacheKey);

  if (!request) {
    request = await findTimeOffRequestById(id);

    if (!request) {
      throw new AppError(404, "Time off request not found");
    }

    await setCached(cacheKey, request);
  }

  if (
    request.employeeId !== actor.userId &&
    !(await hasPermission(actor, "time_off:read:any"))
  ) {
    throw new AppError(403, "You can only read your own time off requests");
  }

  return request;
}

export async function updateTimeOffRequest(
  id: string,
  input: UpdateTimeOffRequestInput,
): Promise<TimeOffRequestRecord> {
  const existing = await findTimeOffRequestById(id);

  if (!existing) {
    throw new AppError(404, "Time off request not found");
  }

  if (existing.status !== "pending") {
    throw new AppError(
      409,
      `This request was already ${existing.status} and can no longer be edited`,
    );
  }

  const startDate = input.startDate ?? existing.startDate;
  const endDate = input.endDate ?? existing.endDate;

  if (endDate < startDate) {
    throw new AppError(400, "endDate must be on or after startDate");
  }

  assertSaneDuration(startDate, endDate);

  try {
    const request = await updateTimeOffRequestById(id, input);

    if (!request) {
      throw new AppError(409, "Time off request was decided before your edit");
    }

    await invalidateTimeOffCaches(id);

    return request;
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

/**
 * Shared approve/reject path. Anything already decided returns 409 rather than
 * silently flipping, and nobody signs off their own leave.
 */
async function decide(
  id: string,
  status: "approved" | "rejected",
  decisionNote: string | null,
  actor: TokenPayload,
): Promise<TimeOffRequestRecord> {
  const existing = await findTimeOffRequestById(id);

  if (!existing) {
    throw new AppError(404, "Time off request not found");
  }

  if (existing.employeeId === actor.userId) {
    throw new AppError(403, "You cannot approve your own time off request");
  }

  if (existing.status !== "pending") {
    throw new AppError(
      409,
      `This time off request was already ${existing.status}`,
    );
  }

  try {
    const request = await decideTimeOffRequest(
      id,
      status,
      actor.userId,
      decisionNote,
    );

    if (!request) {
      throw new AppError(
        409,
        "This time off request was already decided by someone else",
      );
    }

    await invalidateTimeOffCaches(id);

    return request;
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

export async function approveTimeOffRequest(
  id: string,
  input: ApproveTimeOffRequestInput,
  actor: TokenPayload,
): Promise<TimeOffRequestRecord> {
  return decide(id, "approved", input.decisionNote ?? null, actor);
}

export async function rejectTimeOffRequest(
  id: string,
  input: RejectTimeOffRequestInput,
  actor: TokenPayload,
): Promise<TimeOffRequestRecord> {
  return decide(id, "rejected", input.decisionNote, actor);
}

export async function removeTimeOffRequest(id: string): Promise<string> {
  const deletedId = await deleteTimeOffRequestById(id);

  if (!deletedId) {
    throw new AppError(404, "Time off request not found");
  }

  await invalidateTimeOffCaches(id);

  return deletedId;
}
