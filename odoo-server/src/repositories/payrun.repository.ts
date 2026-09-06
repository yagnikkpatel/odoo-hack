import { PoolClient } from "pg";
import { pool } from "../lib/db";
import { STANDARD_HOURS_PER_DAY } from "../lib/payroll-engine";
import {
  PayrollEmployeeOption,
  PayrollWarning,
  PayrunRecord,
} from "../types/payroll";

const PAYRUN_COLUMNS = `
    run.id AS "id",
    run.name AS "name",
    run.structure_id AS "structureId",
    s.name AS "structureName",
    to_char(run.start_date, 'YYYY-MM-DD') AS "startDate",
    to_char(run.end_date, 'YYYY-MM-DD') AS "endDate",
    run.status AS "status",
    COALESCE(
      (
        SELECT array_agg(pe.employee_id ORDER BY u.name ASC)
        FROM payrun_employees pe
        JOIN users u ON u.id = pe.employee_id
        WHERE pe.payrun_id = run.id
      ),
      ARRAY[]::uuid[]
    ) AS "employeeIds",
    (
      SELECT COUNT(*)::int FROM payslips slip WHERE slip.payrun_id = run.id
    ) AS "payslipCount",
    run.warnings AS "warnings",
    run.computed_at AS "computedAt",
    run.validated_at AS "validatedAt",
    run.paid_at AS "paidAt",
    run.created_at AS "createdAt",
    run.updated_at AS "updatedAt"
`;

const PAYRUN_FROM = `
  FROM payruns run
  JOIN salary_structures s ON s.id = run.structure_id
`;

async function replacePayrunEmployees(
  client: PoolClient,
  payrunId: string,
  employeeIds: string[],
): Promise<void> {
  await client.query(
    "DELETE FROM payrun_employees WHERE payrun_id = $1 AND employee_id <> ALL($2::uuid[])",
    [payrunId, employeeIds],
  );

  await client.query(
    `INSERT INTO payrun_employees (payrun_id, employee_id)
     SELECT $1, unnest($2::uuid[])
     ON CONFLICT DO NOTHING`,
    [payrunId, employeeIds],
  );
}

async function selectPayrun(
  client: PoolClient,
  id: string,
): Promise<PayrunRecord> {
  const result = await client.query<PayrunRecord>(
    `SELECT ${PAYRUN_COLUMNS} ${PAYRUN_FROM} WHERE run.id = $1`,
    [id],
  );

  return result.rows[0];
}

export async function insertPayrun(input: {
  name: string;
  structureId: string;
  startDate: string;
  endDate: string;
  employeeIds: string[];
  createdBy?: string;
}): Promise<PayrunRecord> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO payruns (name, structure_id, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        input.name,
        input.structureId,
        input.startDate,
        input.endDate,
        input.createdBy ?? null,
      ],
    );

    const id = inserted.rows[0].id;

    await replacePayrunEmployees(client, id, input.employeeIds);

    const payrun = await selectPayrun(client, id);

    await client.query("COMMIT");

    return payrun;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findPayrunById(id: string): Promise<PayrunRecord | null> {
  const result = await pool.query<PayrunRecord>(
    `SELECT ${PAYRUN_COLUMNS} ${PAYRUN_FROM} WHERE run.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findAllPayruns(query: {
  limit: number;
  offset: number;
  search?: string;
  status?: string;
  structureId?: string;
  from?: string;
  to?: string;
}): Promise<{ rows: PayrunRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(run.name ILIKE $${values.length} OR s.name ILIKE $${values.length})`,
    );
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`run.status = $${values.length}`);
  }

  if (query.structureId) {
    values.push(query.structureId);
    conditions.push(`run.structure_id = $${values.length}`);
  }

  if (query.from) {
    values.push(query.from);
    conditions.push(`run.end_date >= $${values.length}`);
  }

  if (query.to) {
    values.push(query.to);
    conditions.push(`run.start_date <= $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(query.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(query.offset);
  const offsetPlaceholder = `$${values.length}`;

  const result = await pool.query<PayrunRecord & { total: number }>(
    `SELECT COUNT(*) OVER()::int AS "total", ${PAYRUN_COLUMNS}
     ${PAYRUN_FROM}
     ${where}
     ORDER BY run.start_date DESC, run.created_at DESC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  );

  return {
    rows: result.rows.map(({ total, ...payrun }) => payrun),
    total: result.rows[0]?.total ?? 0,
  };
}

/**
 * Rewrites the scope of a draft or computed payrun. Payslips are dropped because
 * a scope change invalidates every previous calculation.
 */
export async function updatePayrunById(
  id: string,
  input: {
    name: string;
    structureId: string;
    startDate: string;
    endDate: string;
    employeeIds: string[];
  },
): Promise<PayrunRecord | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const updated = await client.query<{ id: string }>(
      `UPDATE payruns
       SET name = $1,
           structure_id = $2,
           start_date = $3,
           end_date = $4,
           status = 'draft',
           warnings = '[]'::jsonb,
           computed_at = NULL,
           updated_at = NOW()
       WHERE id = $5
       RETURNING id`,
      [input.name, input.structureId, input.startDate, input.endDate, id],
    );

    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");

      return null;
    }

    await client.query("DELETE FROM payslips WHERE payrun_id = $1", [id]);
    await replacePayrunEmployees(client, id, input.employeeIds);

    const payrun = await selectPayrun(client, id);

    await client.query("COMMIT");

    return payrun;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function removePayrunEmployee(
  payrunId: string,
  employeeId: string,
): Promise<void> {
  await pool.query(
    `DELETE FROM payrun_employees WHERE payrun_id = $1 AND employee_id = $2`,
    [payrunId, employeeId],
  );
}

export async function updatePayrunStatus(
  id: string,
  status: string,
  timestampColumn: "computed_at" | "validated_at" | "paid_at",
  warnings?: PayrollWarning[],
): Promise<PayrunRecord | null> {
  const result = await pool.query<{ id: string }>(
    `UPDATE payruns
     SET status = $1,
         ${timestampColumn} = NOW(),
         warnings = COALESCE($2::jsonb, warnings),
         updated_at = NOW()
     WHERE id = $3
     RETURNING id`,
    [status, warnings ? JSON.stringify(warnings) : null, id],
  );

  if (result.rowCount === 0) {
    return null;
  }

  return findPayrunById(id);
}

/**
 * Sends a payrun back to draft after its scope changed, clearing the results of
 * the compute that no longer describes it.
 */
export async function resetPayrunToDraft(id: string): Promise<void> {
  await pool.query(
    `UPDATE payruns
     SET status = 'draft',
         warnings = '[]'::jsonb,
         computed_at = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

export async function deletePayrunById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM payruns WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

/**
 * Employees who can be added to a payrun for this period: active accounts whose
 * contract covers the whole period. A payslip cannot be calculated without one.
 */
export async function findEligibleEmployees(query: {
  startDate: string;
  endDate: string;
  search?: string;
  department?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: PayrollEmployeeOption[]; total: number }> {
  const conditions = [
    "u.status = 'active'",
    "c.start_date <= $1",
    "c.end_date >= $2",
  ];
  const values: unknown[] = [query.startDate, query.endDate];

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length})`,
    );
  }

  if (query.department) {
    values.push(query.department);
    conditions.push(`p.department = $${values.length}`);
  }

  values.push(query.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(query.offset);
  const offsetPlaceholder = `$${values.length}`;

  const result = await pool.query<PayrollEmployeeOption & { total: number }>(
    `SELECT
       COUNT(*) OVER()::int AS "total",
       u.id AS "id",
       u.name AS "name",
       u.email AS "email",
       COALESCE(p.department, '') AS "department",
       COALESCE(p.job_position, '') AS "jobPosition",
       COALESCE(p.working_schedule, '') AS "workingSchedule",
       c.id AS "contractId",
       to_char(c.start_date, 'YYYY-MM-DD') AS "startDate",
       to_char(c.end_date, 'YYYY-MM-DD') AS "endDate",
       c.wage::float8 AS "wage",
       c.currency AS "currency",
       c.wage_period AS "wagePeriod",
       COALESCE(bank.account_number, '') AS "bankAccount"
     FROM users u
     JOIN contracts c ON c.employee_id = u.id AND c.status = 'running'
     LEFT JOIN employee_profiles p ON p.user_id = u.id
     LEFT JOIN employee_bank_accounts bank ON bank.employee_id = u.id
     WHERE ${conditions.join(" AND ")}
     ORDER BY u.name ASC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  );

  return {
    rows: result.rows.map(({ total, ...employee }) => employee),
    total: result.rows[0]?.total ?? 0,
  };
}

/**
 * Everything one compute pass needs, gathered per selected employee: the
 * applicable contract, the period's attendance, unpaid leave, the payment
 * account, and whether another payrun already paid this period.
 */
export type PayrollComputeInput = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeStatus: string;
  department: string;
  jobPosition: string;
  contractId: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  contractWage: number | null;
  contractCurrency: string | null;
  contractWagePeriod: string | null;
  contractStatus: string | null;
  applicableContracts: number;
  workedDays: number;
  workedHours: number;
  overtimeHours: number;
  openAttendances: number;
  unpaidLeaveDays: number;
  bankAccount: string;
  overlappingPayslips: number;
};

export async function findPayrollComputeInputs(
  payrunId: string,
  startDate: string,
  endDate: string,
): Promise<PayrollComputeInput[]> {
  const result = await pool.query<PayrollComputeInput>(
    `SELECT
       u.id AS "employeeId",
       u.name AS "employeeName",
       u.email AS "employeeEmail",
       u.status AS "employeeStatus",
       COALESCE(p.department, '') AS "department",
       COALESCE(p.job_position, '') AS "jobPosition",
       c.id AS "contractId",
       to_char(c.start_date, 'YYYY-MM-DD') AS "contractStartDate",
       to_char(c.end_date, 'YYYY-MM-DD') AS "contractEndDate",
       c.wage::float8 AS "contractWage",
       c.currency AS "contractCurrency",
       c.wage_period AS "contractWagePeriod",
       c.status AS "contractStatus",
       (
         SELECT COUNT(*)::int
         FROM contracts other
         WHERE other.employee_id = u.id
           AND other.start_date <= $3
           AND other.end_date >= $2
       ) AS "applicableContracts",
       COALESCE(attendance.worked_days, 0) AS "workedDays",
       COALESCE(attendance.worked_hours, 0) AS "workedHours",
       COALESCE(attendance.overtime_hours, 0) AS "overtimeHours",
       COALESCE(attendance.open_attendances, 0) AS "openAttendances",
       COALESCE(leave.unpaid_days, 0) AS "unpaidLeaveDays",
       COALESCE(bank.account_number, '') AS "bankAccount",
       (
         SELECT COUNT(*)::int
         FROM payslips other
         WHERE other.employee_id = u.id
           AND other.payrun_id <> $1
           AND other.start_date <= $3
           AND other.end_date >= $2
       ) AS "overlappingPayslips"
     FROM payrun_employees pe
     JOIN users u ON u.id = pe.employee_id
     LEFT JOIN employee_profiles p ON p.user_id = u.id
     LEFT JOIN employee_bank_accounts bank ON bank.employee_id = u.id
     LEFT JOIN LATERAL (
       SELECT contract.*
       FROM contracts contract
       WHERE contract.employee_id = u.id
         AND contract.start_date <= $2
         AND contract.end_date >= $3
       ORDER BY (contract.status = 'running') DESC, contract.start_date DESC
       LIMIT 1
     ) c ON TRUE
     LEFT JOIN LATERAL (
       SELECT
         COUNT(DISTINCT a.attendance_date) FILTER (
           WHERE a.check_out IS NOT NULL
         )::int AS worked_days,
         COALESCE(SUM(a.worked_hours), 0)::float8 AS worked_hours,
         COALESCE(SUM(a.overtime_hours), 0)::float8 AS overtime_hours,
         COUNT(*) FILTER (
           WHERE a.check_in IS NOT NULL AND a.check_out IS NULL
         )::int AS open_attendances
       FROM attendances a
       WHERE a.employee_id = u.id
         AND a.attendance_date BETWEEN $2 AND $3
     ) attendance ON TRUE
     LEFT JOIN LATERAL (
       SELECT COALESCE(
         SUM(
           CASE
             WHEN t.unit = 'hours'
               THEN (charge->>'amount')::numeric / ${STANDARD_HOURS_PER_DAY}
             ELSE (charge->>'amount')::numeric
           END
         ),
         0
       )::float8 AS unpaid_days
       FROM time_off_requests req
       JOIN time_off_types t ON t.id = req.type_id
       CROSS JOIN LATERAL jsonb_array_elements(req.charges) AS charge
       WHERE req.employee_id = u.id
         AND req.status = 'approved'
         AND t.payroll = 'unpaid'
         -- Cast: the surrounding query already binds $2/$3 as dates, and a
         -- charge date read out of JSONB is text.
         AND (charge->>'date')::date BETWEEN $2::date AND $3::date
     ) leave ON TRUE
     WHERE pe.payrun_id = $1
     ORDER BY u.name ASC`,
    [payrunId, startDate, endDate],
  );

  return result.rows;
}
