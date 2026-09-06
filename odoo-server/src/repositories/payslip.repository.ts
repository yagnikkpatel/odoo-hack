import { pool } from "../lib/db";
import {
  ContractSnapshot,
  PayrollWarning,
  PayslipLine,
  PayslipRecord,
} from "../types/payroll";

const PAYSLIP_COLUMNS = `
    slip.id AS "id",
    slip.payrun_id AS "payrunId",
    run.name AS "payrunName",
    slip.employee_id AS "employeeId",
    slip.employee_name AS "employeeName",
    slip.employee_email AS "employeeEmail",
    slip.department AS "department",
    slip.job_position AS "jobPosition",
    slip.structure_id AS "structureId",
    slip.structure_name AS "structureName",
    to_char(slip.start_date, 'YYYY-MM-DD') AS "startDate",
    to_char(slip.end_date, 'YYYY-MM-DD') AS "endDate",
    slip.status AS "status",
    slip.currency AS "currency",
    slip.worked_days::float8 AS "workedDays",
    slip.worked_hours::float8 AS "workedHours",
    slip.expected_days::float8 AS "expectedDays",
    slip.expected_hours::float8 AS "expectedHours",
    slip.basic::float8 AS "basic",
    slip.allowances::float8 AS "allowances",
    slip.deductions::float8 AS "deductions",
    slip.contributions::float8 AS "contributions",
    slip.gross::float8 AS "gross",
    slip.net::float8 AS "net",
    slip.bank_account AS "bankAccount",
    slip.contract_snapshot AS "contractSnapshot",
    slip.lines AS "lines",
    slip.warnings AS "warnings",
    slip.created_at AS "createdAt",
    slip.updated_at AS "updatedAt"
`;

const PAYSLIP_FROM = `
  FROM payslips slip
  JOIN payruns run ON run.id = slip.payrun_id
`;

export type PayslipWrite = {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  jobPosition: string;
  structureId: string;
  structureName: string;
  startDate: string;
  endDate: string;
  status: string;
  currency: string;
  workedDays: number;
  workedHours: number;
  expectedDays: number;
  expectedHours: number;
  basic: number;
  allowances: number;
  deductions: number;
  contributions: number;
  gross: number;
  net: number;
  bankAccount: string;
  contractSnapshot: ContractSnapshot | null;
  lines: PayslipLine[];
  warnings: PayrollWarning[];
};

/**
 * Replaces every payslip of a payrun in one transaction: recomputing must never
 * leave a payrun holding a mix of old and new calculations.
 */
export async function replacePayrunPayslips(
  payrunId: string,
  payslips: PayslipWrite[],
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM payslips WHERE payrun_id = $1", [payrunId]);

    for (const slip of payslips) {
      await client.query(
        `INSERT INTO payslips (
           payrun_id, employee_id, structure_id, employee_name, employee_email,
           department, job_position, structure_name, start_date, end_date,
           status, currency, worked_days, worked_hours, expected_days,
           expected_hours, basic, allowances, deductions, contributions,
           gross, net, bank_account, contract_snapshot, lines, warnings
         )
         VALUES (
           $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10,
           $11, $12, $13, $14, $15,
           $16, $17, $18, $19, $20,
           $21, $22, $23, $24::jsonb, $25::jsonb, $26::jsonb
         )`,
        [
          payrunId,
          slip.employeeId,
          slip.structureId,
          slip.employeeName,
          slip.employeeEmail,
          slip.department,
          slip.jobPosition,
          slip.structureName,
          slip.startDate,
          slip.endDate,
          slip.status,
          slip.currency,
          slip.workedDays,
          slip.workedHours,
          slip.expectedDays,
          slip.expectedHours,
          slip.basic,
          slip.allowances,
          slip.deductions,
          slip.contributions,
          slip.gross,
          slip.net,
          slip.bankAccount,
          slip.contractSnapshot
            ? JSON.stringify(slip.contractSnapshot)
            : null,
          JSON.stringify(slip.lines),
          JSON.stringify(slip.warnings),
        ],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findPayslipById(
  id: string,
): Promise<PayslipRecord | null> {
  const result = await pool.query<PayslipRecord>(
    `SELECT ${PAYSLIP_COLUMNS} ${PAYSLIP_FROM} WHERE slip.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findAllPayslips(query: {
  limit: number;
  offset: number;
  search?: string;
  status?: string;
  payrunId?: string;
  employeeId?: string;
  department?: string;
  from?: string;
  to?: string;
}): Promise<{ rows: PayslipRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(slip.employee_name ILIKE $${values.length}
        OR slip.employee_email ILIKE $${values.length}
        OR slip.structure_name ILIKE $${values.length}
        OR run.name ILIKE $${values.length})`,
    );
  }

  if (query.status) {
    values.push(query.status);
    conditions.push(`slip.status = $${values.length}`);
  }

  if (query.payrunId) {
    values.push(query.payrunId);
    conditions.push(`slip.payrun_id = $${values.length}`);
  }

  if (query.employeeId) {
    values.push(query.employeeId);
    conditions.push(`slip.employee_id = $${values.length}`);
  }

  if (query.department) {
    values.push(query.department);
    conditions.push(`slip.department = $${values.length}`);
  }

  if (query.from) {
    values.push(query.from);
    conditions.push(`slip.end_date >= $${values.length}`);
  }

  if (query.to) {
    values.push(query.to);
    conditions.push(`slip.start_date <= $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(query.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(query.offset);
  const offsetPlaceholder = `$${values.length}`;

  const result = await pool.query<PayslipRecord & { total: number }>(
    `SELECT COUNT(*) OVER()::int AS "total", ${PAYSLIP_COLUMNS}
     ${PAYSLIP_FROM}
     ${where}
     ORDER BY slip.start_date DESC, slip.employee_name ASC, slip.id ASC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  );

  return {
    rows: result.rows.map(({ total, ...payslip }) => payslip),
    total: result.rows[0]?.total ?? 0,
  };
}

export async function updatePayslipStatusByPayrun(
  payrunId: string,
  status: string,
): Promise<void> {
  await pool.query(
    "UPDATE payslips SET status = $1, updated_at = NOW() WHERE payrun_id = $2",
    [status, payrunId],
  );
}

export async function deletePayslipById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM payslips WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

export async function upsertBankAccount(
  employeeId: string,
  accountNumber: string,
): Promise<{ employeeId: string; accountNumber: string }> {
  const result = await pool.query<{
    employeeId: string;
    accountNumber: string;
  }>(
    `INSERT INTO employee_bank_accounts (employee_id, account_number)
     VALUES ($1, $2)
     ON CONFLICT (employee_id) DO UPDATE
       SET account_number = EXCLUDED.account_number, updated_at = NOW()
     RETURNING employee_id AS "employeeId", account_number AS "accountNumber"`,
    [employeeId, accountNumber],
  );

  return result.rows[0];
}

export async function findBankAccounts(): Promise<
  { employeeId: string; accountNumber: string }[]
> {
  const result = await pool.query<{
    employeeId: string;
    accountNumber: string;
  }>(
    `SELECT employee_id AS "employeeId", account_number AS "accountNumber"
     FROM employee_bank_accounts`,
  );

  return result.rows;
}
