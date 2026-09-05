import { z } from "zod";
import { AppError } from "../errors/AppError";
import { withTransaction } from "../lib/db";
import { buildPageMeta, parsePageParams } from "../lib/pagination";
import { allocateNumber } from "../lib/sequences";
import { parseOrThrow } from "../lib/validate";
import * as employeeRepository from "../repositories/employee.repository";
import * as orgRepository from "../repositories/org.repository";
import { EmployeeRow, EmployeeWriteData } from "../types/employee";

const SORTABLE = [
  "first_name",
  "last_name",
  "employee_number",
  "hire_date",
  "created_at",
];

const EMPLOYMENT_STATUSES = ["active", "on_leave", "suspended", "terminated"] as const;
const GENDERS = ["male", "female", "other", "undisclosed"] as const;

const nullableString = z.string().trim().min(1).nullable().optional();
const nullableUuid = z.uuid().nullable().optional();
const nullableDate = z.iso.date().nullable().optional();

const employeeSchema = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().min(1).max(80),
  work_email: z.email().toLowerCase().nullable().optional(),
  personal_email: z.email().toLowerCase().nullable().optional(),
  work_phone: nullableString,
  mobile_phone: nullableString,
  date_of_birth: nullableDate,
  gender: z.enum(GENDERS).nullable().optional(),
  marital_status: nullableString,
  address_line1: nullableString,
  address_line2: nullableString,
  city: nullableString,
  state: nullableString,
  postal_code: nullableString,
  country: nullableString,
  emergency_contact_name: nullableString,
  emergency_contact_phone: nullableString,
  department_id: nullableUuid,
  job_position_id: nullableUuid,
  manager_id: nullableUuid,
  working_schedule_id: nullableUuid,
  employment_status: z.enum(EMPLOYMENT_STATUSES).optional(),
  hire_date: nullableDate,
  bank_name: nullableString,
  bank_account_number: nullableString,
  bank_ifsc: nullableString,
  tax_identification_number: nullableString,
});

const terminateSchema = z.object({
  termination_date: z.iso.date().optional(),
  reason: z.string().trim().optional(),
});

export async function list(
  query: Record<string, unknown>,
  scope: { onlyId: string | null; unmasked: boolean },
) {
  const params = parsePageParams(query, { sortable: SORTABLE, defaultSort: "first_name" });

  const { rows, total } = await employeeRepository.list(params, {
    departmentId: str(query.department_id),
    jobPositionId: str(query.job_position_id),
    managerId: str(query.manager_id),
    employmentStatus: str(query.employment_status),
    onlyId: scope.onlyId ?? undefined,
  });

  return {
    rows: rows.map((row) => presentListItem(row)),
    meta: buildPageMeta(params, total),
  };
}

export async function getById(
  id: string,
  scope: { onlyId: string | null; unmasked: boolean },
) {
  const employee = await loadVisible(id, scope.onlyId);

  return present(employee, scope.unmasked);
}

export async function create(input: unknown) {
  const data = parseOrThrow(employeeSchema, input);

  await assertReferencesExist(data);
  await assertWorkEmailFree(data.work_email, null);

  if (data.manager_id) {
    await assertManagerExists(data.manager_id);
  }

  // The number is allocated inside the same transaction as the insert, so a failed insert
  // consumes nothing (BR-X-9).
  const employee = await withTransaction(async (client) => {
    const employeeNumber = await allocateNumber(client, "employee");

    return employeeRepository.insert(employeeNumber, toWriteData(data), client);
  });

  return present(employee, true);
}

export async function update(id: string, input: unknown) {
  const data = parseOrThrow(employeeSchema.partial(), input);
  const existing = await loadVisible(id, null);

  await assertReferencesExist(data);
  await assertWorkEmailFree(data.work_email, id);

  if (data.manager_id !== undefined && data.manager_id !== null) {
    await assertManagerExists(data.manager_id);
    await assertNoManagerCycle(id, data.manager_id);
  }

  if (data.hire_date !== undefined && existing.termination_date && data.hire_date) {
    assertOrder(data.hire_date, existing.termination_date);
  }

  const updated = await employeeRepository.update(id, toWriteData(data));

  return present(updated as EmployeeRow, true);
}

/** BR-EMP-4: never a hard delete — payroll history and contracts depend on the row. */
export async function terminate(id: string, input: unknown) {
  const data = parseOrThrow(terminateSchema, input ?? {});
  const existing = await loadVisible(id, null);
  const terminationDate = data.termination_date ?? today();

  if (existing.hire_date) {
    assertOrder(existing.hire_date, terminationDate);
  }

  await employeeRepository.terminate(id, terminationDate);

  // Phase 2 extends this to expire the running contract as of the same date (BR-CON-8).
}

export async function getSummary(id: string, scope: { onlyId: string | null }) {
  const employee = await loadVisible(id, scope.onlyId);

  return {
    employee: slim(employee),
    counts: {
      // Filled in as each module lands: contracts (Phase 2), attendance (3A),
      // time off (3B), payslips (5).
      contracts: 0,
      attendances_this_month: 0,
      time_off_requests_pending: 0,
      allocations_active: 0,
      payslips: 0,
    },
    current_contract: null,
    leave_balances: [],
    data_completeness: {
      has_bank_details: Boolean(
        employee.bank_name && employee.bank_account_number && employee.bank_ifsc,
      ),
      has_working_schedule: Boolean(employee.working_schedule_id),
      has_running_contract: employee.has_running_contract,
      has_work_email: Boolean(employee.work_email),
    },
  };
}

export async function setPhoto(id: string, photo: { url: string; publicId: string }) {
  await loadVisible(id, null);

  return employeeRepository.setPhoto(id, photo);
}

// ── helpers ────────────────────────────────────────────────────────────────

async function loadVisible(id: string, onlyId: string | null): Promise<EmployeeRow> {
  const employee = await employeeRepository.findById(id);

  // BR-RBAC-8: a caller who may not see the record gets 404, not 403 — a 403 would confirm
  // the record exists.
  if (!employee || (onlyId && employee.id !== onlyId)) {
    throw new AppError(404, "Employee not found.", "not_found");
  }

  return employee;
}

async function assertReferencesExist(data: {
  department_id?: string | null;
  job_position_id?: string | null;
}): Promise<void> {
  if (data.department_id && !(await orgRepository.findDepartment(data.department_id))) {
    throw new AppError(400, "Unknown department.", "validation_error", [
      { field: "department_id", message: "no such department" },
    ]);
  }

  if (data.job_position_id && !(await orgRepository.findJobPosition(data.job_position_id))) {
    throw new AppError(400, "Unknown job position.", "validation_error", [
      { field: "job_position_id", message: "no such job position" },
    ]);
  }
}

async function assertManagerExists(managerId: string): Promise<void> {
  if (!(await employeeRepository.findById(managerId))) {
    throw new AppError(400, "Unknown manager.", "validation_error", [
      { field: "manager_id", message: "no such employee" },
    ]);
  }
}

/** BR-EMP-3 */
async function assertNoManagerCycle(employeeId: string, managerId: string): Promise<void> {
  if (employeeId === managerId) {
    throw new AppError(400, "An employee cannot be their own manager.", "manager_cycle", [
      { field: "manager_id", message: "cannot reference itself" },
    ]);
  }

  if (await employeeRepository.managerChainContains(managerId, employeeId)) {
    throw new AppError(
      400,
      "That manager already reports to this employee — the reporting line would loop.",
      "manager_cycle",
      [{ field: "manager_id", message: "would create a cycle" }],
    );
  }
}

async function assertWorkEmailFree(
  workEmail: string | null | undefined,
  selfId: string | null,
): Promise<void> {
  if (!workEmail) {
    return;
  }

  const owner = await employeeRepository.findWorkEmailOwner(workEmail);

  if (owner && owner !== selfId) {
    throw new AppError(
      409,
      "That work email is already in use by another employee.",
      "duplicate_work_email",
    );
  }
}

/** BR-EMP-5 */
function assertOrder(hireDate: string, terminationDate: string): void {
  if (terminationDate < hireDate) {
    throw new AppError(
      400,
      "Termination date cannot precede the hire date.",
      "validation_error",
      [{ field: "termination_date", message: `must be on or after ${hireDate}` }],
    );
  }
}

function toWriteData(data: Record<string, unknown>): EmployeeWriteData {
  return data as EmployeeWriteData;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** BR-RBAC-7: only a caller who can run payroll sees a full account number. */
function maskAccount(value: string | null, unmasked: boolean): string | null {
  if (!value || unmasked) {
    return value;
  }

  return value.length <= 4 ? "••••" : `••••${value.slice(-4)}`;
}

function slim(row: EmployeeRow) {
  return {
    id: row.id,
    employee_number: row.employee_number,
    full_name: `${row.first_name} ${row.last_name}`,
    photo_url: row.photo_url,
  };
}

function presentListItem(row: EmployeeRow) {
  return {
    id: row.id,
    employee_number: row.employee_number,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: `${row.first_name} ${row.last_name}`,
    work_email: row.work_email,
    work_phone: row.work_phone,
    photo_url: row.photo_url,
    department: row.department_id ? { id: row.department_id, name: row.department_name } : null,
    job_position: row.job_position_id
      ? { id: row.job_position_id, name: row.job_position_name }
      : null,
    manager: row.manager_id
      ? {
          id: row.manager_id,
          employee_number: row.manager_employee_number,
          full_name: row.manager_full_name,
          photo_url: row.manager_photo_url,
        }
      : null,
    employment_status: row.employment_status,
    has_running_contract: row.has_running_contract,
  };
}

function present(row: EmployeeRow, unmasked: boolean) {
  return {
    ...presentListItem(row),
    personal_email: row.personal_email,
    mobile_phone: row.mobile_phone,
    date_of_birth: row.date_of_birth,
    gender: row.gender,
    marital_status: row.marital_status,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    country: row.country,
    emergency_contact_name: row.emergency_contact_name,
    emergency_contact_phone: row.emergency_contact_phone,
    working_schedule: row.working_schedule_id
      ? {
          id: row.working_schedule_id,
          name: row.working_schedule_name,
          hours_per_week: row.working_schedule_hours,
        }
      : null,
    hire_date: row.hire_date,
    termination_date: row.termination_date,
    bank_name: row.bank_name,
    bank_account_number: maskAccount(row.bank_account_number, unmasked),
    bank_ifsc: row.bank_ifsc,
    tax_identification_number: row.tax_identification_number,
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
