import { pool } from "../lib/db";
import {
  AllocationRecord,
  Consumption,
  DayCharge,
  Decision,
  TimeOffRequestRecord,
  TimeOffSnapshot,
  TimeOffTypeRecord,
} from "../types/time-off";

const TYPE_COLUMNS = `
    t.id AS "id",
    t.name AS "name",
    t.code AS "code",
    t.unit AS "unit",
    t.requires_allocation AS "requiresAllocation",
    t.approval AS "approval",
    t.payroll AS "payroll",
    t.active AS "active",
    t.description AS "description",
    t.created_at AS "createdAt",
    t.updated_at AS "updatedAt"
`;

// NUMERIC arrives as a string over the pg wire protocol, so every amount and
// duration is cast to float8 here rather than parsed in the service.
const ALLOCATION_COLUMNS = `
    a.id AS "id",
    a.employee_id AS "employeeId",
    a.type_id AS "typeId",
    a.amount::float8 AS "amount",
    to_char(a.valid_from, 'YYYY-MM-DD') AS "validFrom",
    COALESCE(to_char(a.valid_to, 'YYYY-MM-DD'), '') AS "validTo",
    a.note AS "note",
    a.status AS "status",
    a.history AS "history",
    a.created_at AS "createdAt",
    a.updated_at AS "updatedAt"
`;

const REQUEST_COLUMNS = `
    r.id AS "id",
    r.employee_id AS "employeeId",
    r.type_id AS "typeId",
    to_char(r.start_date, 'YYYY-MM-DD') AS "startDate",
    to_char(r.end_date, 'YYYY-MM-DD') AS "endDate",
    r.start_time AS "startTime",
    r.end_time AS "endTime",
    r.reason AS "reason",
    r.unit AS "unit",
    r.duration::float8 AS "duration",
    r.charges AS "charges",
    r.consumptions AS "consumptions",
    r.status AS "status",
    r.history AS "history",
    r.created_at AS "createdAt",
    r.updated_at AS "updatedAt"
`;

const TYPE_UPDATABLE_COLUMNS: Record<string, string> = {
  name: "name",
  code: "code",
  unit: "unit",
  requiresAllocation: "requires_allocation",
  approval: "approval",
  payroll: "payroll",
  active: "active",
  description: "description",
};

const ALLOCATION_UPDATABLE_COLUMNS: Record<string, string> = {
  employeeId: "employee_id",
  typeId: "type_id",
  amount: "amount",
  validFrom: "valid_from",
  validTo: "valid_to",
  note: "note",
  status: "status",
  history: "history",
};

const REQUEST_UPDATABLE_COLUMNS: Record<string, string> = {
  employeeId: "employee_id",
  typeId: "type_id",
  startDate: "start_date",
  endDate: "end_date",
  startTime: "start_time",
  endTime: "end_time",
  reason: "reason",
  unit: "unit",
  duration: "duration",
  charges: "charges",
  consumptions: "consumptions",
  status: "status",
  history: "history",
};

/** node-pg turns JS arrays into Postgres array literals, so these go as JSON text. */
const JSONB_FIELDS = new Set(["history", "charges", "consumptions"]);

/** '' is the open-ended sentinel on the wire; the column is nullable. */
const NULLABLE_DATE_FIELDS = new Set(["validTo"]);

export type TypeFields = {
  name?: string;
  code?: string;
  unit?: string;
  requiresAllocation?: boolean;
  approval?: string;
  payroll?: string;
  active?: boolean;
  description?: string;
};

export type AllocationFields = {
  employeeId?: string;
  typeId?: string;
  amount?: number;
  validFrom?: string;
  validTo?: string;
  note?: string;
  status?: string;
  history?: Decision[];
};

export type RequestFields = {
  employeeId?: string;
  typeId?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  reason?: string;
  unit?: string;
  duration?: number;
  charges?: DayCharge[];
  consumptions?: Consumption[];
  status?: string;
  history?: Decision[];
};

function buildAssignments(
  columns: Record<string, string>,
  fields: Record<string, unknown>,
  values: unknown[],
): string[] {
  const assignments: string[] = [];

  for (const [key, column] of Object.entries(columns)) {
    const value = fields[key];

    if (value === undefined) {
      continue;
    }

    if (JSONB_FIELDS.has(key)) {
      values.push(JSON.stringify(value));
      assignments.push(`${column} = $${values.length}::jsonb`);

      continue;
    }

    values.push(
      NULLABLE_DATE_FIELDS.has(key) && value === "" ? null : value,
    );
    assignments.push(`${column} = $${values.length}`);
  }

  return assignments;
}

export async function findAllTypes(): Promise<TimeOffTypeRecord[]> {
  const result = await pool.query<TimeOffTypeRecord>(
    `SELECT ${TYPE_COLUMNS} FROM time_off_types t ORDER BY t.created_at DESC`,
  );

  return result.rows;
}

export async function findTypeById(
  id: string,
): Promise<TimeOffTypeRecord | null> {
  const result = await pool.query<TimeOffTypeRecord>(
    `SELECT ${TYPE_COLUMNS} FROM time_off_types t WHERE t.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function insertType(input: {
  name: string;
  code: string;
  unit: string;
  requiresAllocation: boolean;
  approval: string;
  payroll: string;
  active: boolean;
  description: string;
}): Promise<TimeOffTypeRecord> {
  const result = await pool.query<TimeOffTypeRecord>(
    `WITH inserted AS (
       INSERT INTO time_off_types (
         name, code, unit, requires_allocation, approval, payroll, active, description
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *
     )
     SELECT ${TYPE_COLUMNS} FROM inserted t`,
    [
      input.name,
      input.code,
      input.unit,
      input.requiresAllocation,
      input.approval,
      input.payroll,
      input.active,
      input.description,
    ],
  );

  return result.rows[0];
}

export async function updateTypeById(
  id: string,
  fields: TypeFields,
): Promise<TimeOffTypeRecord | null> {
  const values: unknown[] = [];
  const assignments = buildAssignments(
    TYPE_UPDATABLE_COLUMNS,
    fields as Record<string, unknown>,
    values,
  );

  assignments.push("updated_at = NOW()");
  values.push(id);

  const result = await pool.query<TimeOffTypeRecord>(
    `WITH updated AS (
       UPDATE time_off_types
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING *
     )
     SELECT ${TYPE_COLUMNS} FROM updated t`,
    values,
  );

  return result.rows[0] ?? null;
}

export async function deleteTypeById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM time_off_types WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

export async function findAllAllocations(): Promise<AllocationRecord[]> {
  const result = await pool.query<AllocationRecord>(
    `SELECT ${ALLOCATION_COLUMNS}
     FROM time_off_allocations a
     ORDER BY a.created_at DESC`,
  );

  return result.rows;
}

export async function findAllocationsByEmployee(
  employeeId: string,
): Promise<AllocationRecord[]> {
  const result = await pool.query<AllocationRecord>(
    `SELECT ${ALLOCATION_COLUMNS}
     FROM time_off_allocations a
     WHERE a.employee_id = $1
     ORDER BY a.created_at DESC`,
    [employeeId],
  );

  return result.rows;
}

export async function findAllocationById(
  id: string,
): Promise<AllocationRecord | null> {
  const result = await pool.query<AllocationRecord>(
    `SELECT ${ALLOCATION_COLUMNS} FROM time_off_allocations a WHERE a.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function insertAllocation(input: {
  employeeId: string;
  typeId: string;
  amount: number;
  validFrom: string;
  validTo: string;
  note: string;
  status: string;
  history: Decision[];
}): Promise<AllocationRecord> {
  const result = await pool.query<AllocationRecord>(
    `WITH inserted AS (
       INSERT INTO time_off_allocations (
         employee_id, type_id, amount, valid_from, valid_to, note, status, history
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING *
     )
     SELECT ${ALLOCATION_COLUMNS} FROM inserted a`,
    [
      input.employeeId,
      input.typeId,
      input.amount,
      input.validFrom,
      input.validTo === "" ? null : input.validTo,
      input.note,
      input.status,
      JSON.stringify(input.history),
    ],
  );

  return result.rows[0];
}

export async function updateAllocationById(
  id: string,
  fields: AllocationFields,
): Promise<AllocationRecord | null> {
  const values: unknown[] = [];
  const assignments = buildAssignments(
    ALLOCATION_UPDATABLE_COLUMNS,
    fields as Record<string, unknown>,
    values,
  );

  assignments.push("updated_at = NOW()");
  values.push(id);

  const result = await pool.query<AllocationRecord>(
    `WITH updated AS (
       UPDATE time_off_allocations
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING *
     )
     SELECT ${ALLOCATION_COLUMNS} FROM updated a`,
    values,
  );

  return result.rows[0] ?? null;
}

export async function deleteAllocationById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM time_off_allocations WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

export async function findAllRequests(): Promise<TimeOffRequestRecord[]> {
  const result = await pool.query<TimeOffRequestRecord>(
    `SELECT ${REQUEST_COLUMNS}
     FROM time_off_requests r
     ORDER BY r.created_at DESC`,
  );

  return result.rows;
}

export async function findRequestsByEmployee(
  employeeId: string,
): Promise<TimeOffRequestRecord[]> {
  const result = await pool.query<TimeOffRequestRecord>(
    `SELECT ${REQUEST_COLUMNS}
     FROM time_off_requests r
     WHERE r.employee_id = $1
     ORDER BY r.created_at DESC`,
    [employeeId],
  );

  return result.rows;
}

export async function findRequestById(
  id: string,
): Promise<TimeOffRequestRecord | null> {
  const result = await pool.query<TimeOffRequestRecord>(
    `SELECT ${REQUEST_COLUMNS} FROM time_off_requests r WHERE r.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function insertRequest(input: {
  employeeId: string;
  typeId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  unit: string;
  duration: number;
  charges: DayCharge[];
  consumptions: Consumption[];
  status: string;
  history: Decision[];
}): Promise<TimeOffRequestRecord> {
  const result = await pool.query<TimeOffRequestRecord>(
    `WITH inserted AS (
       INSERT INTO time_off_requests (
         employee_id, type_id, start_date, end_date, start_time, end_time,
         reason, unit, duration, charges, consumptions, status, history
       )
       VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13::jsonb
       )
       RETURNING *
     )
     SELECT ${REQUEST_COLUMNS} FROM inserted r`,
    [
      input.employeeId,
      input.typeId,
      input.startDate,
      input.endDate,
      input.startTime,
      input.endTime,
      input.reason,
      input.unit,
      input.duration,
      JSON.stringify(input.charges),
      JSON.stringify(input.consumptions),
      input.status,
      JSON.stringify(input.history),
    ],
  );

  return result.rows[0];
}

export async function updateRequestById(
  id: string,
  fields: RequestFields,
): Promise<TimeOffRequestRecord | null> {
  const values: unknown[] = [];
  const assignments = buildAssignments(
    REQUEST_UPDATABLE_COLUMNS,
    fields as Record<string, unknown>,
    values,
  );

  assignments.push("updated_at = NOW()");
  values.push(id);

  const result = await pool.query<TimeOffRequestRecord>(
    `WITH updated AS (
       UPDATE time_off_requests
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING *
     )
     SELECT ${REQUEST_COLUMNS} FROM updated r`,
    values,
  );

  return result.rows[0] ?? null;
}

export async function deleteRequestById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM time_off_requests WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

export async function countTypeReferences(
  typeId: string,
): Promise<{ allocations: number; requests: number }> {
  const result = await pool.query<{ allocations: number; requests: number }>(
    `SELECT
       (SELECT COUNT(*)::int FROM time_off_allocations WHERE type_id = $1) AS "allocations",
       (SELECT COUNT(*)::int FROM time_off_requests WHERE type_id = $1) AS "requests"`,
    [typeId],
  );

  return result.rows[0];
}

export async function findSnapshot(): Promise<TimeOffSnapshot> {
  const [types, allocations, requests] = await Promise.all([
    findAllTypes(),
    findAllAllocations(),
    findAllRequests(),
  ]);

  return { types, allocations, requests };
}
