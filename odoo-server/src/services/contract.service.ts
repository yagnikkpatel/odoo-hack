import { z } from "zod";
import { AppError } from "../errors/AppError";
import { withTransaction } from "../lib/db";
import { buildPageMeta, parsePageParams } from "../lib/pagination";
import { money } from "../lib/money";
import { allocateNumber } from "../lib/sequences";
import { parseOrThrow } from "../lib/validate";
import * as contractRepository from "../repositories/contract.repository";
import * as employeeRepository from "../repositories/employee.repository";
import * as scheduleRepository from "../repositories/schedule.repository";
import { pool } from "../lib/db";
import { ContractRow, ContractStatus, ContractWriteData } from "../types/contract";

const SORTABLE = ["start_date", "end_date", "reference", "wage", "status", "created_at"];

const contractSchema = z.object({
  employee_id: z.uuid(),
  start_date: z.iso.date(),
  end_date: z.iso.date().nullable().optional(),
  employment_type_id: z.uuid(),
  department_id: z.uuid().nullable().optional(),
  job_position_id: z.uuid().nullable().optional(),
  working_schedule_id: z.uuid(),
  salary_structure_id: z.uuid(),
  wage: z.union([z.string(), z.number()]),
  wage_type: z.enum(["monthly", "hourly", "daily"]).optional(),
  notes: z.string().trim().nullable().optional(),
});

/** BR-CON-3: the only transitions the API permits. */
const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ["running", "cancelled"],
  running: ["expired", "cancelled"],
  expired: [],
  cancelled: [],
};

export async function list(query: Record<string, unknown>) {
  const params = parsePageParams(query, {
    sortable: SORTABLE,
    defaultSort: "start_date",
    defaultOrder: "desc",
  });

  const { rows, total } = await contractRepository.list(params, {
    employeeId: str(query.employee_id),
    status: str(query.status),
    departmentId: str(query.department_id),
    employmentTypeId: str(query.employment_type_id),
    activeOn: str(query.active_on),
  });

  return { rows: rows.map(present), meta: buildPageMeta(params, total) };
}

export async function getById(id: string) {
  return present(await load(id));
}

export async function create(input: unknown) {
  const data = parseOrThrow(contractSchema, input);

  await assertReferencesExist(data);
  assertDateOrder(data.start_date, data.end_date ?? null);

  // Created as draft, so the overlap constraint does not bite yet (BR-CON-1).
  const contract = await withTransaction(async (client) => {
    const reference = await allocateNumber(client, "contract");

    return contractRepository.insert(reference, toWriteData(data), client);
  });

  return present(contract);
}

export async function update(id: string, input: unknown) {
  const data = parseOrThrow(contractSchema.partial(), input);
  const existing = await load(id);

  assertMutable(existing);

  const startDate = data.start_date ?? existing.start_date;
  const endDate = data.end_date === undefined ? existing.end_date : data.end_date;

  assertDateOrder(startDate, endDate);
  await assertReferencesExist(data);

  // Widening a running contract's window can collide; report it before the constraint does.
  if (existing.status === "running" || existing.status === "expired") {
    await assertNoOverlap(existing.employee_id, startDate, endDate, id);
  }

  return present((await contractRepository.update(id, toWriteData(data))) as ContractRow);
}

/** BR-CON-1, BR-CON-3: `draft → running`, and the point the no-overlap rule bites. */
export async function activate(id: string) {
  const existing = await load(id);

  assertTransition(existing, "running");
  await assertNoOverlap(existing.employee_id, existing.start_date, existing.end_date, id);

  return present((await contractRepository.setStatus(id, "running")) as ContractRow);
}

export async function cancel(id: string) {
  const existing = await load(id);

  assertTransition(existing, "cancelled");

  return present((await contractRepository.setStatus(id, "cancelled")) as ContractRow);
}

/** BR-CON-7: only a draft is deletable; anything ever in force is cancelled instead. */
export async function remove(id: string): Promise<void> {
  const existing = await load(id);

  if (existing.status !== "draft") {
    throw new AppError(
      422,
      `Only a draft contract can be deleted — this one is ${existing.status}. Cancel it instead.`,
      "invalid_state_transition",
    );
  }

  await contractRepository.remove(id);
}

/** BR-CON-5: the resolution payroll reuses. */
export async function findApplicable(query: Record<string, unknown>) {
  const schema = z.object({
    employee_id: z.uuid(),
    period_start: z.iso.date(),
    period_end: z.iso.date(),
  });

  const { employee_id, period_start, period_end } = parseOrThrow(schema, query);

  if (period_end < period_start) {
    throw new AppError(400, "period_end precedes period_start.", "validation_error", [
      { field: "period_end", message: `must be on or after ${period_start}` },
    ]);
  }

  const contract = await contractRepository.findApplicable(
    employee_id,
    period_start,
    period_end,
  );

  if (!contract) {
    throw new AppError(
      404,
      `No running contract covers ${period_start} – ${period_end} for that employee.`,
      "no_applicable_contract",
    );
  }

  return present(contract);
}

/** Called when an employee is terminated (BR-CON-8). */
export async function expireRunningForEmployee(
  employeeId: string,
  onDate: string,
): Promise<void> {
  await contractRepository.expireRunningForEmployee(employeeId, onDate, pool);
}

// ── helpers ────────────────────────────────────────────────────────────────

async function load(id: string): Promise<ContractRow> {
  const contract = await contractRepository.findById(id);

  if (!contract) {
    throw new AppError(404, "Contract not found.", "not_found");
  }

  return contract;
}

function assertTransition(contract: ContractRow, to: ContractStatus): void {
  if (!ALLOWED_TRANSITIONS[contract.status].includes(to)) {
    throw new AppError(
      422,
      `A ${contract.status} contract cannot become ${to}.`,
      "invalid_state_transition",
    );
  }
}

function assertMutable(contract: ContractRow): void {
  if (contract.status === "cancelled" || contract.status === "expired") {
    throw new AppError(
      422,
      `A ${contract.status} contract is a historical record and cannot be edited.`,
      "record_locked",
    );
  }
}

function assertDateOrder(startDate: string, endDate: string | null): void {
  if (endDate && endDate < startDate) {
    throw new AppError(400, "The end date precedes the start date.", "validation_error", [
      { field: "end_date", message: `must be on or after ${startDate}` },
    ]);
  }
}

/**
 * BR-CON-1. The EXCLUDE constraint is the real guarantee; this check exists so the caller gets
 * a message naming the conflict rather than a bare constraint error (task 2.8).
 */
async function assertNoOverlap(
  employeeId: string,
  startDate: string,
  endDate: string | null,
  excludeId: string | null,
): Promise<void> {
  const conflict = await contractRepository.findOverlapping(
    employeeId,
    startDate,
    endDate,
    excludeId,
  );

  if (conflict) {
    throw new AppError(
      409,
      `${conflict.employee_full_name} already has a contract in force from ` +
        `${conflict.start_date} to ${conflict.end_date ?? "open-ended"}.`,
      "contract_overlap",
      [{ field: "start_date", message: `conflicts with ${conflict.reference}` }],
    );
  }
}

async function assertReferencesExist(data: {
  employee_id?: string;
  working_schedule_id?: string;
  employment_type_id?: string;
  salary_structure_id?: string;
}): Promise<void> {
  if (data.employee_id && !(await employeeRepository.findById(data.employee_id))) {
    throw new AppError(400, "Unknown employee.", "validation_error", [
      { field: "employee_id", message: "no such employee" },
    ]);
  }

  if (
    data.working_schedule_id &&
    !(await scheduleRepository.findById(data.working_schedule_id))
  ) {
    throw new AppError(400, "Unknown working schedule.", "validation_error", [
      { field: "working_schedule_id", message: "no such working schedule" },
    ]);
  }
}

function toWriteData(data: Record<string, unknown>): ContractWriteData {
  const write = { ...data } as ContractWriteData;

  // Money stays a decimal string end to end (BR-X-3).
  if (data.wage !== undefined) {
    write.wage = money(data.wage as string | number);
  }

  return write;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function present(row: ContractRow) {
  return {
    id: row.id,
    reference: row.reference,
    employee: {
      id: row.employee_id,
      employee_number: row.employee_number,
      full_name: row.employee_full_name,
      photo_url: row.employee_photo_url,
    },
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    is_active_now: row.is_active_now,
    employment_type: {
      id: row.employment_type_id,
      name: row.employment_type_name,
      code: row.employment_type_code,
      active: true,
    },
    department: row.department_id ? { id: row.department_id, name: row.department_name } : null,
    job_position: row.job_position_id
      ? { id: row.job_position_id, name: row.job_position_name }
      : null,
    working_schedule: {
      id: row.working_schedule_id,
      name: row.working_schedule_name,
      hours_per_week: row.working_schedule_hours,
    },
    salary_structure: { id: row.salary_structure_id, name: row.salary_structure_name },
    wage: row.wage,
    wage_type: row.wage_type,
    currency_code: row.currency_code,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
