import { AppError } from "../errors/AppError";
import {
  bumpCacheVersion,
  getCacheVersion,
  getCached,
  invalidateCache,
  setCached,
} from "../lib/cache";
import { getRolePermissions } from "./permission.service";
import {
  countTypeReferences,
  deleteAllocationById,
  deleteRequestById,
  deleteTypeById,
  findAllAllocations,
  findAllRequests,
  findAllTypes,
  findAllocationById,
  findAllocationsByEmployee,
  findRequestById,
  findRequestsByEmployee,
  findSnapshot,
  findTypeById,
  insertAllocation,
  insertRequest,
  insertType,
  updateAllocationById,
  updateRequestById,
  updateTypeById,
} from "../repositories/time-off.repository";
import {
  CreateAllocationInput,
  CreateRequestInput,
  CreateTypeInput,
  UpdateAllocationInput,
  UpdateRequestInput,
  UpdateTypeInput,
} from "../types/time-off.dto";
import {
  AllocationRecord,
  Consumption,
  DayCharge,
  DEFAULT_BREAK_MINUTES,
  DEFAULT_WORKDAY_END,
  DEFAULT_WORKDAY_START,
  Decision,
  LeaveUnit,
  MAX_REQUEST_DAYS,
  TimeOffRequestRecord,
  TimeOffSnapshot,
  TimeOffTypeRecord,
} from "../types/time-off";
import { TokenPayload } from "../types/user";

const TIME_OFF_NAMESPACE = "time-off-list";

/**
 * Hour fractions are compared, summed and re-summed across approvals. Keeping
 * twelve significant decimals stops float drift from manufacturing a phantom
 * shortfall; presentation rounds to two places on the client.
 */
const EPSILON = 1e-8;

function rounded(amount: number): number {
  return Math.round(amount * 1e12) / 1e12;
}

function nowIso(): string {
  return new Date().toISOString();
}

function decision(
  action: string,
  at: string,
  actorId: string,
  reason?: string,
): Decision {
  return { at, actorId, action, ...(reason ? { reason } : {}) };
}

function typeCacheKey(id: string): string {
  return `time-off:type:${id}`;
}

function allocationCacheKey(id: string): string {
  return `time-off:allocation:${id}`;
}

function requestCacheKey(id: string): string {
  return `time-off:request:${id}`;
}

function listCacheKey(version: number, scope: string): string {
  return `${TIME_OFF_NAMESPACE}:v${version}:${scope}`;
}

/**
 * Any write can shift a balance that a list elsewhere in the module renders, so
 * every mutation bumps the shared namespace version rather than reasoning about
 * which collections it touched.
 */
async function invalidateTimeOffCaches(recordKeys: string[]): Promise<void> {
  await invalidateCache(recordKeys);
  await bumpCacheVersion(TIME_OFF_NAMESPACE);
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
    return new AppError(404, "Employee or time off type not found");
  }

  if (code === "23505") {
    if (constraint === "time_off_types_name_unique_idx") {
      return new AppError(409, "A time off type already uses this name");
    }

    if (constraint === "time_off_types_code_unique_idx") {
      return new AppError(409, "A time off type already uses this code");
    }

    return new AppError(409, "A time off type already uses this name or code");
  }

  if (code === "23514") {
    if (constraint === "time_off_types_code_check") {
      return new AppError(
        400,
        "Use a code of 1-16 letters, numbers, hyphens or underscores",
      );
    }

    if (constraint === "time_off_types_name_check") {
      return new AppError(400, "Enter a name between 1 and 100 characters");
    }

    if (constraint === "time_off_types_unit_check") {
      return new AppError(400, "Choose days or hours");
    }

    if (constraint === "time_off_types_approval_check") {
      return new AppError(400, "Choose a valid approval policy");
    }

    if (constraint === "time_off_types_payroll_check") {
      return new AppError(400, "Choose a valid payroll treatment");
    }

    if (constraint === "time_off_allocations_amount_check") {
      return new AppError(
        400,
        "Enter a positive allocation of no more than 100,000 units",
      );
    }

    if (constraint === "time_off_allocations_range_check") {
      return new AppError(
        400,
        "Allocation expiry cannot be before its start date",
      );
    }

    if (constraint === "time_off_requests_range_check") {
      return new AppError(400, "End date cannot be before start date");
    }

    if (constraint === "time_off_requests_duration_check") {
      return new AppError(400, "A request must cover at least some working time");
    }

    if (
      constraint === "time_off_allocations_status_check" ||
      constraint === "time_off_requests_status_check"
    ) {
      return new AppError(400, "Invalid time off status");
    }

    return new AppError(400, "Time off violates a database constraint");
  }

  return null;
}

function rethrow(error: unknown): never {
  if (error instanceof AppError) {
    throw error;
  }

  const domainError = toDomainError(error);

  if (domainError) {
    throw domainError;
  }

  throw error;
}

function formatAmount(amount: number, unit: LeaveUnit): string {
  const value = new Intl.NumberFormat("en", {
    maximumFractionDigits: 2,
  }).format(amount);

  return `${value} ${amount === 1 ? unit.slice(0, -1) : unit}`;
}

function timeMinutes(value: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return NaN;
  }

  const [hours, minutes] = value.split(":").map(Number);

  return hours * 60 + minutes;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T12:00:00Z`);

  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= "1900-01-01" &&
    value <= "2100-12-31"
  );
}

function assertValidDate(value: string, label: string): void {
  if (!validDate(value)) {
    throw new AppError(400, `Enter a valid ${label} between 1900 and 2100`);
  }
}

function dateRange(start: string, end: string): string[] {
  const days =
    Math.round(
      (Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) /
        86_400_000,
    ) + 1;

  if (days > MAX_REQUEST_DAYS) {
    throw new AppError(
      400,
      `A request can span at most ${MAX_REQUEST_DAYS} calendar days`,
    );
  }

  return Array.from({ length: days }, (_, index) =>
    new Date(Date.parse(`${start}T12:00:00Z`) + index * 86_400_000)
      .toISOString()
      .slice(0, 10),
  );
}

type SchedulePeriod = { start: string; end: string; breakMinutes: number };

/**
 * Working Schedules has no backend yet, so every employee gets the documented
 * fallback calendar. Swap this for the employee's assigned schedule -- and take
 * an employeeId here -- once that module lands.
 */
function periodsForDate(date: string): SchedulePeriod[] {
  const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;

  return day < 5
    ? [
        {
          start: DEFAULT_WORKDAY_START,
          end: DEFAULT_WORKDAY_END,
          breakMinutes: DEFAULT_BREAK_MINUTES,
        },
      ]
    : [];
}

function netMinutesForDate(date: string): number {
  return periodsForDate(date).reduce(
    (total, period) =>
      total +
      timeMinutes(period.end) -
      timeMinutes(period.start) -
      period.breakMinutes,
    0,
  );
}

type RequestShape = {
  employeeId: string;
  typeId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reason: string;
};

type ComputedRequest = {
  unit: LeaveUnit;
  duration: number;
  charges: DayCharge[];
};

/**
 * The authoritative duration. Deliberately never derived from a client-supplied
 * value: the same rules run in the client's logic.ts only to preview them.
 */
function computeRequest(
  input: Pick<RequestShape, "startDate" | "endDate" | "startTime" | "endTime">,
  type: TimeOffTypeRecord,
): ComputedRequest {
  assertValidDate(input.startDate, "start date");
  assertValidDate(input.endDate, "end date");

  if (input.startDate > input.endDate) {
    throw new AppError(400, "End date cannot be before start date");
  }

  const dates = dateRange(input.startDate, input.endDate);

  if (type.unit === "hours" && dates.length !== 1) {
    throw new AppError(400, "Hourly leave must start and end on the same date");
  }

  const charges: DayCharge[] = [];

  for (const date of dates) {
    const periods = periodsForDate(date);
    const dailyMinutes = netMinutesForDate(date);

    if (type.unit === "days") {
      if (dailyMinutes > 0) {
        charges.push({ date, amount: 1 });
      }

      continue;
    }

    const start = timeMinutes(input.startTime);
    const end = timeMinutes(input.endTime);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      throw new AppError(
        400,
        "Choose valid times with the end after the start on the same day",
      );
    }

    if (!dailyMinutes || end - start > dailyMinutes) {
      throw new AppError(
        400,
        "Hourly leave cannot exceed the net scheduled working hours for that day",
      );
    }

    // Break placement is unknown, so require the range to sit inside a single
    // scheduled period on top of the daily net-hours cap.
    if (
      !periods.some(
        (period) =>
          start >= timeMinutes(period.start) && end <= timeMinutes(period.end),
      )
    ) {
      throw new AppError(
        400,
        "Hourly leave must fit within one scheduled working period",
      );
    }

    charges.push({ date, amount: rounded((end - start) / 60) });
  }

  if (!charges.length) {
    throw new AppError(400, "This range contains no scheduled working days");
  }

  return {
    unit: type.unit,
    duration: rounded(
      charges.reduce((sum, charge) => sum + charge.amount, 0),
    ),
    charges,
  };
}

type OverlapCandidate = {
  unit: LeaveUnit;
  charges: DayCharge[];
  startTime: string;
  endTime: string;
};

function overlaps(
  candidate: OverlapCandidate,
  existing: TimeOffRequestRecord,
): boolean {
  if (existing.status !== "pending" && existing.status !== "approved") {
    return false;
  }

  const sharedDate = candidate.charges.some((charge) =>
    existing.charges.some((other) => other.date === charge.date),
  );

  return (
    sharedDate &&
    (candidate.unit === "days" ||
      existing.unit === "days" ||
      (candidate.startTime < existing.endTime &&
        existing.startTime < candidate.endTime))
  );
}

function assertNoOverlap(
  requests: TimeOffRequestRecord[],
  candidate: OverlapCandidate,
  excludeId?: string,
): void {
  const conflict = requests.some(
    (item) => item.id !== excludeId && overlaps(candidate, item),
  );

  if (conflict) {
    throw new AppError(
      409,
      "This employee already has pending or approved time off during this period",
    );
  }
}

function assertHourlyCapacity(
  requests: TimeOffRequestRecord[],
  candidate: Pick<OverlapCandidate, "unit" | "charges">,
  excludeId?: string,
): void {
  if (candidate.unit !== "hours") {
    return;
  }

  for (const charge of candidate.charges) {
    const dailyMinutes = netMinutesForDate(charge.date);
    const otherHours = requests
      .filter(
        (item) =>
          item.id !== excludeId &&
          item.unit === "hours" &&
          (item.status === "pending" || item.status === "approved"),
      )
      .reduce(
        (sum, item) =>
          sum +
          item.charges
            .filter((other) => other.date === charge.date)
            .reduce((subtotal, other) => subtotal + other.amount, 0),
        0,
      );

    if (charge.amount + otherHours - dailyMinutes / 60 > EPSILON) {
      throw new AppError(
        409,
        `Combined pending and approved hourly leave exceeds the net scheduled hours on ${charge.date}`,
      );
    }
  }
}

/**
 * Only approved requests draw down a balance. Cancelled requests keep their
 * consumptions for audit but release the allocation.
 */
function consumedByAllocation(
  requests: TimeOffRequestRecord[],
): Map<string, number> {
  const consumed = new Map<string, number>();

  for (const request of requests) {
    if (request.status !== "approved") {
      continue;
    }

    for (const item of request.consumptions) {
      consumed.set(
        item.allocationId,
        rounded((consumed.get(item.allocationId) ?? 0) + item.amount),
      );
    }
  }

  return consumed;
}

type EmployeeLedger = {
  allocations: AllocationRecord[];
  requests: TimeOffRequestRecord[];
};

/**
 * Overlap, capacity and consumption all reason about one employee only:
 * an allocation and every request drawing on it belong to the same person.
 */
async function loadEmployeeLedger(
  employeeId: string,
): Promise<EmployeeLedger> {
  const [allocations, requests] = await Promise.all([
    findAllocationsByEmployee(employeeId),
    findRequestsByEmployee(employeeId),
  ]);

  return { allocations, requests };
}

/** Earliest-expiring allocation first, so grants are used before they lapse. */
function planConsumption(
  ledger: EmployeeLedger,
  type: TimeOffTypeRecord,
  charges: DayCharge[],
): Consumption[] {
  if (!type.requiresAllocation) {
    return [];
  }

  const consumed = consumedByAllocation(ledger.requests);
  const grants = ledger.allocations
    .filter((item) => item.typeId === type.id && item.status === "approved")
    .sort(
      (a, b) =>
        (a.validTo || "9999-12-31").localeCompare(b.validTo || "9999-12-31") ||
        a.validFrom.localeCompare(b.validFrom) ||
        a.id.localeCompare(b.id),
    );

  const consumptions: Consumption[] = [];

  for (const charge of [...charges].sort((a, b) =>
    a.date.localeCompare(b.date),
  )) {
    let needed = charge.amount;

    for (const grant of grants) {
      if (
        grant.validFrom > charge.date ||
        (grant.validTo && grant.validTo < charge.date)
      ) {
        continue;
      }

      const available = rounded(grant.amount - (consumed.get(grant.id) ?? 0));
      const amount = Math.min(available, needed);

      if (amount <= EPSILON) {
        continue;
      }

      consumptions.push({
        allocationId: grant.id,
        date: charge.date,
        amount: rounded(amount),
      });
      consumed.set(
        grant.id,
        rounded((consumed.get(grant.id) ?? 0) + amount),
      );
      needed = rounded(needed - amount);

      if (needed <= EPSILON) {
        break;
      }
    }

    if (needed > EPSILON) {
      throw new AppError(
        409,
        `Insufficient approved allocation on ${charge.date}. ${formatAmount(needed, type.unit)} more required for that date.`,
      );
    }
  }

  return consumptions;
}

export async function getTimeOffSnapshot(): Promise<TimeOffSnapshot> {
  const version = await getCacheVersion(TIME_OFF_NAMESPACE);
  const cacheKey = listCacheKey(version, "snapshot");
  const cached = await getCached<TimeOffSnapshot>(cacheKey);

  if (cached) {
    return cached;
  }

  const snapshot = await findSnapshot();

  await setCached(cacheKey, snapshot);

  return snapshot;
}

export async function listTypes(): Promise<TimeOffTypeRecord[]> {
  const version = await getCacheVersion(TIME_OFF_NAMESPACE);
  const cacheKey = listCacheKey(version, "types");
  const cached = await getCached<TimeOffTypeRecord[]>(cacheKey);

  if (cached) {
    return cached;
  }

  const types = await findAllTypes();

  await setCached(cacheKey, types);

  return types;
}

export async function getType(id: string): Promise<TimeOffTypeRecord> {
  const cacheKey = typeCacheKey(id);
  const cached = await getCached<TimeOffTypeRecord>(cacheKey);

  if (cached) {
    return cached;
  }

  const type = await findTypeById(id);

  if (!type) {
    throw new AppError(404, "Time off type not found");
  }

  await setCached(cacheKey, type);

  return type;
}

async function requireType(id: string): Promise<TimeOffTypeRecord> {
  const type = await findTypeById(id);

  if (!type) {
    throw new AppError(404, "Time off type not found");
  }

  return type;
}

async function requireActiveType(id: string): Promise<TimeOffTypeRecord> {
  const type = await requireType(id);

  if (!type.active) {
    throw new AppError(400, "Choose an active time off type");
  }

  return type;
}

function normaliseCode(code: string): string {
  const normalised = code.trim().toUpperCase();

  if (!/^[A-Z0-9_-]{1,16}$/.test(normalised)) {
    throw new AppError(
      400,
      "Use a code of 1-16 letters, numbers, hyphens or underscores",
    );
  }

  return normalised;
}

export async function createType(
  input: CreateTypeInput,
): Promise<TimeOffTypeRecord> {
  try {
    const type = await insertType({ ...input, code: normaliseCode(input.code) });

    await invalidateTimeOffCaches([]);

    return type;
  } catch (error) {
    rethrow(error);
  }
}

export async function updateType(
  id: string,
  input: UpdateTypeInput,
): Promise<TimeOffTypeRecord> {
  const existing = await requireType(id);
  const next = {
    name: input.name ?? existing.name,
    code: input.code ? normaliseCode(input.code) : existing.code,
    unit: input.unit ?? existing.unit,
    requiresAllocation: input.requiresAllocation ?? existing.requiresAllocation,
    approval: input.approval ?? existing.approval,
    payroll: input.payroll ?? existing.payroll,
    active: input.active ?? existing.active,
    description: input.description ?? existing.description,
  };

  const references = await countTypeReferences(id);

  // Changing these after the fact would silently rewrite the meaning of leave
  // already recorded against the type, so the policy is frozen once it is used.
  if (
    references.allocations + references.requests > 0 &&
    (next.unit !== existing.unit ||
      next.requiresAllocation !== existing.requiresAllocation ||
      next.approval !== existing.approval ||
      next.payroll !== existing.payroll)
  ) {
    throw new AppError(
      409,
      "This type is already used. Create a new type to change its unit, allocation, approval or payroll policy.",
    );
  }

  try {
    const type = await updateTypeById(id, next);

    if (!type) {
      throw new AppError(404, "Time off type not found");
    }

    await invalidateTimeOffCaches([typeCacheKey(id)]);

    return type;
  } catch (error) {
    rethrow(error);
  }
}

export async function removeType(id: string): Promise<string> {
  await requireType(id);

  const references = await countTypeReferences(id);

  if (references.allocations + references.requests > 0) {
    throw new AppError(
      409,
      "This type is referenced by allocations or requests. Archive it instead.",
    );
  }

  const deletedId = await deleteTypeById(id);

  if (!deletedId) {
    throw new AppError(404, "Time off type not found");
  }

  await invalidateTimeOffCaches([typeCacheKey(id)]);

  return deletedId;
}

export async function listAllocations(): Promise<AllocationRecord[]> {
  const version = await getCacheVersion(TIME_OFF_NAMESPACE);
  const cacheKey = listCacheKey(version, "allocations");
  const cached = await getCached<AllocationRecord[]>(cacheKey);

  if (cached) {
    return cached;
  }

  const allocations = await findAllAllocations();

  await setCached(cacheKey, allocations);

  return allocations;
}

export async function listMyAllocations(
  employeeId: string,
): Promise<AllocationRecord[]> {
  const version = await getCacheVersion(TIME_OFF_NAMESPACE);
  const cacheKey = listCacheKey(version, `allocations:${employeeId}`);
  const cached = await getCached<AllocationRecord[]>(cacheKey);

  if (cached) {
    return cached;
  }

  const allocations = await findAllocationsByEmployee(employeeId);

  await setCached(cacheKey, allocations);

  return allocations;
}

export async function getAllocation(id: string): Promise<AllocationRecord> {
  const cacheKey = allocationCacheKey(id);
  const cached = await getCached<AllocationRecord>(cacheKey);

  if (cached) {
    return cached;
  }

  const allocation = await findAllocationById(id);

  if (!allocation) {
    throw new AppError(404, "Allocation not found");
  }

  await setCached(cacheKey, allocation);

  return allocation;
}

function assertAllocatable(type: TimeOffTypeRecord): void {
  if (!type.active) {
    throw new AppError(400, "Choose an active time off type");
  }

  if (!type.requiresAllocation) {
    throw new AppError(400, "This time off type does not require allocations");
  }
}

function assertAllocationDates(validFrom: string, validTo: string): void {
  assertValidDate(validFrom, "allocation start date");

  if (validTo) {
    assertValidDate(validTo, "allocation expiry date");

    if (validFrom > validTo) {
      throw new AppError(
        400,
        "Allocation expiry cannot be before its start date",
      );
    }
  }
}

export async function createAllocation(
  input: CreateAllocationInput,
  actorId: string,
): Promise<AllocationRecord> {
  const type = await requireType(input.typeId);

  assertAllocatable(type);
  assertAllocationDates(input.validFrom, input.validTo);

  const at = nowIso();

  try {
    const allocation = await insertAllocation({
      ...input,
      status: "pending",
      history: [decision("Submitted", at, actorId)],
    });

    await invalidateTimeOffCaches([]);

    return allocation;
  } catch (error) {
    rethrow(error);
  }
}

export async function updateAllocation(
  id: string,
  input: UpdateAllocationInput,
  actorId: string,
): Promise<AllocationRecord> {
  const existing = await findAllocationById(id);

  if (!existing) {
    throw new AppError(404, "Allocation not found");
  }

  if (existing.status === "approved") {
    throw new AppError(
      409,
      "Approved allocations cannot be edited. Create a separate allocation instead.",
    );
  }

  const next = {
    employeeId: input.employeeId ?? existing.employeeId,
    typeId: input.typeId ?? existing.typeId,
    amount: input.amount ?? existing.amount,
    validFrom: input.validFrom ?? existing.validFrom,
    validTo: input.validTo ?? existing.validTo,
    note: input.note ?? existing.note,
  };

  const type = await requireType(next.typeId);

  assertAllocatable(type);
  assertAllocationDates(next.validFrom, next.validTo);

  const at = nowIso();

  try {
    // An edit is a resubmission: the allocation goes back to the approver.
    const allocation = await updateAllocationById(id, {
      ...next,
      status: "pending",
      history: [...existing.history, decision("Resubmitted", at, actorId)],
    });

    if (!allocation) {
      throw new AppError(404, "Allocation not found");
    }

    await invalidateTimeOffCaches([allocationCacheKey(id)]);

    return allocation;
  } catch (error) {
    rethrow(error);
  }
}

export async function approveAllocation(
  id: string,
  actorId: string,
): Promise<AllocationRecord> {
  const existing = await findAllocationById(id);

  if (!existing || existing.status !== "pending") {
    throw new AppError(409, "Only pending allocations can be approved");
  }

  const type = await requireType(existing.typeId);

  assertAllocatable(type);
  assertAllocationDates(existing.validFrom, existing.validTo);

  const at = nowIso();
  const allocation = await updateAllocationById(id, {
    status: "approved",
    history: [...existing.history, decision("Approved", at, actorId)],
  });

  if (!allocation) {
    throw new AppError(404, "Allocation not found");
  }

  await invalidateTimeOffCaches([allocationCacheKey(id)]);

  return allocation;
}

export async function refuseAllocation(
  id: string,
  reason: string,
  actorId: string,
): Promise<AllocationRecord> {
  const existing = await findAllocationById(id);

  if (!existing || existing.status !== "pending") {
    throw new AppError(409, "Only pending allocations can be refused");
  }

  const at = nowIso();
  const allocation = await updateAllocationById(id, {
    status: "refused",
    history: [...existing.history, decision("Refused", at, actorId, reason)],
  });

  if (!allocation) {
    throw new AppError(404, "Allocation not found");
  }

  await invalidateTimeOffCaches([allocationCacheKey(id)]);

  return allocation;
}

export async function removeAllocation(id: string): Promise<string> {
  const existing = await findAllocationById(id);

  if (!existing) {
    throw new AppError(404, "Allocation not found");
  }

  if (existing.status === "approved") {
    throw new AppError(
      409,
      "Approved allocations are historical records and cannot be deleted",
    );
  }

  const requests = await findRequestsByEmployee(existing.employeeId);

  if (
    requests.some((request) =>
      request.consumptions.some((item) => item.allocationId === id),
    )
  ) {
    throw new AppError(
      409,
      "This allocation is linked to approved leave history and cannot be deleted",
    );
  }

  const deletedId = await deleteAllocationById(id);

  if (!deletedId) {
    throw new AppError(404, "Allocation not found");
  }

  await invalidateTimeOffCaches([allocationCacheKey(id)]);

  return deletedId;
}

export async function listRequests(): Promise<TimeOffRequestRecord[]> {
  const version = await getCacheVersion(TIME_OFF_NAMESPACE);
  const cacheKey = listCacheKey(version, "requests");
  const cached = await getCached<TimeOffRequestRecord[]>(cacheKey);

  if (cached) {
    return cached;
  }

  const requests = await findAllRequests();

  await setCached(cacheKey, requests);

  return requests;
}

export async function listMyRequests(
  employeeId: string,
): Promise<TimeOffRequestRecord[]> {
  const version = await getCacheVersion(TIME_OFF_NAMESPACE);
  const cacheKey = listCacheKey(version, `requests:${employeeId}`);
  const cached = await getCached<TimeOffRequestRecord[]>(cacheKey);

  if (cached) {
    return cached;
  }

  const requests = await findRequestsByEmployee(employeeId);

  await setCached(cacheKey, requests);

  return requests;
}

export async function getRequest(id: string): Promise<TimeOffRequestRecord> {
  const cacheKey = requestCacheKey(id);
  const cached = await getCached<TimeOffRequestRecord>(cacheKey);

  if (cached) {
    return cached;
  }

  const request = await findRequestById(id);

  if (!request) {
    throw new AppError(404, "Time off request not found");
  }

  await setCached(cacheKey, request);

  return request;
}

/** The hours-only fields are meaningless for day-long leave; keep them empty. */
function normaliseTimes(
  unit: LeaveUnit,
  startTime: string,
  endTime: string,
): { startTime: string; endTime: string } {
  return unit === "days"
    ? { startTime: "", endTime: "" }
    : { startTime, endTime };
}

/**
 * The route accepts both `create:own` and `create:any` so an employee can file
 * for themselves. Only `create:any` may name someone else -- otherwise a
 * `create:own` holder could impersonate any employeeId in the body.
 */
async function assertCanFileRequest(
  employeeId: string,
  actor: TokenPayload,
): Promise<void> {
  const permissions = await getRolePermissions(actor.role);

  if (employeeId !== actor.userId) {
    if (!permissions.has("time_off:create:any")) {
      throw new AppError(
        403,
        "Missing required permission: time_off:create:any to file for another employee",
      );
    }

    return;
  }

  if (
    !permissions.has("time_off:create:own") &&
    !permissions.has("time_off:create:any")
  ) {
    throw new AppError(403, "Missing required permission: time_off:create:own");
  }
}

export async function createRequest(
  input: CreateRequestInput,
  actor: TokenPayload,
): Promise<TimeOffRequestRecord> {
  await assertCanFileRequest(input.employeeId, actor);

  const type = await requireActiveType(input.typeId);
  const times = normaliseTimes(type.unit, input.startTime, input.endTime);
  const computed = computeRequest({ ...input, ...times }, type);
  const ledger = await loadEmployeeLedger(input.employeeId);

  assertNoOverlap(ledger.requests, { ...computed, ...times });
  assertHourlyCapacity(ledger.requests, computed);

  const consumptions = planConsumption(ledger, type, computed.charges);
  const automatic = type.approval === "none";
  const at = nowIso();

  try {
    const request = await insertRequest({
      employeeId: input.employeeId,
      typeId: input.typeId,
      startDate: input.startDate,
      endDate: input.endDate,
      ...times,
      reason: input.reason,
      unit: computed.unit,
      duration: computed.duration,
      charges: computed.charges,
      consumptions: automatic ? consumptions : [],
      status: automatic ? "approved" : "pending",
      history: [
        decision("Submitted", at, actor.userId),
        ...(automatic
          ? [decision("Automatically approved", at, actor.userId)]
          : []),
      ],
    });

    await invalidateTimeOffCaches([]);

    return request;
  } catch (error) {
    rethrow(error);
  }
}

export async function updateRequest(
  id: string,
  input: UpdateRequestInput,
  actorId: string,
): Promise<TimeOffRequestRecord> {
  const existing = await findRequestById(id);

  if (!existing) {
    throw new AppError(404, "Time off request not found");
  }

  if (existing.status !== "pending" && existing.status !== "refused") {
    throw new AppError(
      409,
      "Only pending or refused requests can be edited. Cancel approved leave before submitting a replacement.",
    );
  }

  const next: RequestShape = {
    employeeId: input.employeeId ?? existing.employeeId,
    typeId: input.typeId ?? existing.typeId,
    startDate: input.startDate ?? existing.startDate,
    endDate: input.endDate ?? existing.endDate,
    startTime: input.startTime ?? existing.startTime,
    endTime: input.endTime ?? existing.endTime,
    reason: input.reason ?? existing.reason,
  };

  const type = await requireActiveType(next.typeId);
  const times = normaliseTimes(type.unit, next.startTime, next.endTime);
  const computed = computeRequest({ ...next, ...times }, type);
  const ledger = await loadEmployeeLedger(next.employeeId);

  assertNoOverlap(ledger.requests, { ...computed, ...times }, id);
  assertHourlyCapacity(ledger.requests, computed, id);

  const consumptions = planConsumption(ledger, type, computed.charges);
  const automatic = type.approval === "none";
  const at = nowIso();

  try {
    const request = await updateRequestById(id, {
      ...next,
      ...times,
      unit: computed.unit,
      duration: computed.duration,
      charges: computed.charges,
      consumptions: automatic ? consumptions : [],
      status: automatic ? "approved" : "pending",
      history: [
        ...existing.history,
        decision("Resubmitted", at, actorId),
        ...(automatic ? [decision("Automatically approved", at, actorId)] : []),
      ],
    });

    if (!request) {
      throw new AppError(404, "Time off request not found");
    }

    await invalidateTimeOffCaches([requestCacheKey(id)]);

    return request;
  } catch (error) {
    rethrow(error);
  }
}

/**
 * Compared field-wise rather than by JSON string: jsonb does not preserve key
 * order, and the amounts are floats.
 */
function chargesMatch(left: DayCharge[], right: DayCharge[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (charge, index) =>
        charge.date === right[index].date &&
        Math.abs(charge.amount - right[index].amount) <= EPSILON,
    )
  );
}

export async function approveRequest(
  id: string,
  actorId: string,
): Promise<TimeOffRequestRecord> {
  const existing = await findRequestById(id);

  if (!existing || existing.status !== "pending") {
    throw new AppError(409, "Only pending requests can be approved");
  }

  const type = await requireActiveType(existing.typeId);
  const computed = computeRequest(existing, type);

  // The stored duration was computed when the request was submitted. If the
  // schedule has moved since, the approver must not silently book a different
  // amount of leave than the employee asked for. Compare at the column's
  // NUMERIC(10,2) precision, otherwise a 50 minute request (0.8333 hours stored
  // as 0.83) would look changed on every approval.
  if (
    computed.unit !== existing.unit ||
    Math.abs(Number(computed.duration.toFixed(2)) - existing.duration) >
      EPSILON ||
    !chargesMatch(computed.charges, existing.charges)
  ) {
    throw new AppError(
      409,
      "The working schedule changed. Edit and resubmit this request to review its updated duration.",
    );
  }

  const ledger = await loadEmployeeLedger(existing.employeeId);

  assertNoOverlap(ledger.requests, existing, id);
  assertHourlyCapacity(ledger.requests, existing, id);

  const consumptions = planConsumption(ledger, type, existing.charges);
  const at = nowIso();
  const request = await updateRequestById(id, {
    consumptions,
    status: "approved",
    history: [...existing.history, decision("Approved", at, actorId)],
  });

  if (!request) {
    throw new AppError(404, "Time off request not found");
  }

  await invalidateTimeOffCaches([requestCacheKey(id)]);

  return request;
}

export async function refuseRequest(
  id: string,
  reason: string,
  actorId: string,
): Promise<TimeOffRequestRecord> {
  const existing = await findRequestById(id);

  if (!existing || existing.status !== "pending") {
    throw new AppError(409, "Only pending requests can be refused");
  }

  const at = nowIso();
  const request = await updateRequestById(id, {
    status: "refused",
    history: [...existing.history, decision("Refused", at, actorId, reason)],
  });

  if (!request) {
    throw new AppError(404, "Time off request not found");
  }

  await invalidateTimeOffCaches([requestCacheKey(id)]);

  return request;
}

export async function cancelRequest(
  id: string,
  reason: string,
  actorId: string,
): Promise<TimeOffRequestRecord> {
  const existing = await findRequestById(id);

  if (
    !existing ||
    (existing.status !== "pending" && existing.status !== "approved")
  ) {
    throw new AppError(409, "Only pending or approved requests can be cancelled");
  }

  const at = nowIso();

  // Consumption references are retained for audit; only approved requests draw
  // down a balance, so cancelling releases the allocation on its own.
  const request = await updateRequestById(id, {
    status: "cancelled",
    history: [...existing.history, decision("Cancelled", at, actorId, reason)],
  });

  if (!request) {
    throw new AppError(404, "Time off request not found");
  }

  await invalidateTimeOffCaches([requestCacheKey(id)]);

  return request;
}

export async function removeRequest(id: string): Promise<string> {
  const existing = await findRequestById(id);

  if (!existing) {
    throw new AppError(404, "Time off request not found");
  }

  if (existing.status === "approved") {
    throw new AppError(
      409,
      "Cancel approved leave before deleting it, so its balance is restored",
    );
  }

  const deletedId = await deleteRequestById(id);

  if (!deletedId) {
    throw new AppError(404, "Time off request not found");
  }

  await invalidateTimeOffCaches([requestCacheKey(id)]);

  return deletedId;
}
