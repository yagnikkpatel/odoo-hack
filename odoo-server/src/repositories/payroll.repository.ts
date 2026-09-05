import { PoolClient } from "pg";
import { pool } from "../lib/db";
import {
  EngineAttendance,
  EngineBank,
  EngineContract,
  EngineEmployee,
  EngineLeave,
  EngineOverlap,
  ComputedPayslip,
} from "../lib/payroll-engine";
import {
  BankDetailsRecord,
  EligibleEmployee,
  PayrunRecord,
  PayrunStatus,
  PayslipRecord,
  SalaryRuleRecord,
  SalaryStructureRecord,
} from "../types/payroll";

type Queryable = Pick<PoolClient, "query">;

export async function withTransaction<T>(
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Salary rules
// ---------------------------------------------------------------------------

const RULE_COLUMNS = `
    sr.id AS "id",
    sr.name AS "name",
    sr.code AS "code",
    sr.category AS "category",
    sr.sequence::int AS "sequence",
    sr.method AS "method",
    sr.amount::float8 AS "amount",
    sr.percentage::float8 AS "percentage",
    sr.base AS "base",
    sr.formula AS "formula",
    sr.description AS "description",
    sr.active AS "active",
    (SELECT COUNT(*) FROM salary_structure_rules ssr WHERE ssr.rule_id = sr.id)::int AS "structureCount",
    sr.created_at AS "createdAt",
    sr.updated_at AS "updatedAt"
`;

const RULE_UPDATABLE: Record<string, string> = {
  name: "name",
  code: "code",
  category: "category",
  sequence: "sequence",
  method: "method",
  amount: "amount",
  percentage: "percentage",
  base: "base",
  formula: "formula",
  description: "description",
  active: "active",
};

export type RuleFields = Partial<{
  name: string;
  code: string;
  category: string;
  sequence: number;
  method: string;
  amount: number;
  percentage: number;
  base: string;
  formula: string;
  description: string;
  active: boolean;
}>;

export async function findAllRules(db: Queryable = pool): Promise<SalaryRuleRecord[]> {
  const result = await db.query<SalaryRuleRecord>(
    `SELECT ${RULE_COLUMNS} FROM salary_rules sr ORDER BY sr.sequence, sr.code`,
  );

  return result.rows;
}

export async function findRuleById(id: string): Promise<SalaryRuleRecord | null> {
  const result = await pool.query<SalaryRuleRecord>(
    `SELECT ${RULE_COLUMNS} FROM salary_rules sr WHERE sr.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findRulesForStructure(
  structureId: string,
  db: Queryable = pool,
): Promise<SalaryRuleRecord[]> {
  const result = await db.query<SalaryRuleRecord>(
    `SELECT ${RULE_COLUMNS}
     FROM salary_structure_rules ssr
     JOIN salary_rules sr ON sr.id = ssr.rule_id
     WHERE ssr.structure_id = $1
     ORDER BY sr.sequence, sr.code`,
    [structureId],
  );

  return result.rows;
}

export async function insertRule(input: {
  name: string;
  code: string;
  category: string;
  sequence: number;
  method: string;
  amount: number;
  percentage: number;
  base: string;
  formula: string;
  description: string;
  active: boolean;
}): Promise<SalaryRuleRecord> {
  const result = await pool.query<SalaryRuleRecord>(
    `WITH inserted AS (
       INSERT INTO salary_rules
         (name, code, category, sequence, method, amount, percentage, base, formula, description, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *
     )
     SELECT ${RULE_COLUMNS} FROM inserted sr`,
    [
      input.name,
      input.code,
      input.category,
      input.sequence,
      input.method,
      input.amount,
      input.percentage,
      input.base,
      input.formula,
      input.description,
      input.active,
    ],
  );

  return result.rows[0];
}

export async function updateRuleById(
  id: string,
  fields: RuleFields,
  db: Queryable = pool,
): Promise<SalaryRuleRecord | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(RULE_UPDATABLE)) {
    const value = fields[key as keyof RuleFields];

    if (value !== undefined) {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    }
  }

  assignments.push("updated_at = NOW()");
  values.push(id);

  const result = await db.query<SalaryRuleRecord>(
    `WITH updated AS (
       UPDATE salary_rules SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING *
     )
     SELECT ${RULE_COLUMNS} FROM updated sr`,
    values,
  );

  return result.rows[0] ?? null;
}

export async function deleteRuleById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM salary_rules WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Salary structures
// ---------------------------------------------------------------------------

const STRUCTURE_COLUMNS = `
    s.id AS "id",
    s.name AS "name",
    s.description AS "description",
    s.active AS "active",
    COALESCE((
      SELECT array_agg(ssr.rule_id ORDER BY sr.sequence, sr.code)
      FROM salary_structure_rules ssr
      JOIN salary_rules sr ON sr.id = ssr.rule_id
      WHERE ssr.structure_id = s.id
    ), '{}'::uuid[]) AS "ruleIds",
    (SELECT COUNT(*) FROM salary_structure_rules ssr WHERE ssr.structure_id = s.id)::int AS "ruleCount",
    (SELECT COUNT(*) FROM contracts c WHERE c.salary_structure_id = s.id AND c.status = 'running')::int AS "employeeCount",
    (SELECT COUNT(*) FROM payruns r WHERE r.structure_id = s.id)::int AS "payrunCount",
    s.created_at AS "createdAt",
    s.updated_at AS "updatedAt"
`;

export async function findAllStructures(): Promise<SalaryStructureRecord[]> {
  const result = await pool.query<SalaryStructureRecord>(
    `SELECT ${STRUCTURE_COLUMNS} FROM salary_structures s ORDER BY s.name`,
  );

  return result.rows;
}

export async function findStructureById(
  id: string,
  db: Queryable = pool,
): Promise<SalaryStructureRecord | null> {
  const result = await db.query<SalaryStructureRecord>(
    `SELECT ${STRUCTURE_COLUMNS} FROM salary_structures s WHERE s.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

async function replaceStructureRules(
  client: PoolClient,
  structureId: string,
  ruleIds: string[],
): Promise<void> {
  await client.query("DELETE FROM salary_structure_rules WHERE structure_id = $1", [
    structureId,
  ]);

  if (ruleIds.length > 0) {
    await client.query(
      `INSERT INTO salary_structure_rules (structure_id, rule_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT DO NOTHING`,
      [structureId, ruleIds],
    );
  }
}

async function applySequences(
  client: PoolClient,
  sequences: { ruleId: string; sequence: number }[],
): Promise<void> {
  for (const item of sequences) {
    await client.query(
      "UPDATE salary_rules SET sequence = $2, updated_at = NOW() WHERE id = $1",
      [item.ruleId, item.sequence],
    );
  }
}

export async function insertStructure(input: {
  name: string;
  description: string;
  active: boolean;
  ruleIds: string[];
  sequences: { ruleId: string; sequence: number }[];
}): Promise<SalaryStructureRecord> {
  return withTransaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO salary_structures (name, description, active)
       VALUES ($1, $2, $3) RETURNING id`,
      [input.name, input.description, input.active],
    );
    const id = inserted.rows[0].id;
    await applySequences(client, input.sequences);
    await replaceStructureRules(client, id, input.ruleIds);
    const structure = await findStructureById(id, client);

    return structure as SalaryStructureRecord;
  });
}

export async function updateStructureById(
  id: string,
  input: {
    name?: string;
    description?: string;
    active?: boolean;
    ruleIds?: string[];
    sequences?: { ruleId: string; sequence: number }[];
  },
): Promise<SalaryStructureRecord | null> {
  return withTransaction(async (client) => {
    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const [key, column] of [
      ["name", "name"],
      ["description", "description"],
      ["active", "active"],
    ] as const) {
      const value = input[key];

      if (value !== undefined) {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      }
    }

    assignments.push("updated_at = NOW()");
    values.push(id);

    const updated = await client.query<{ id: string }>(
      `UPDATE salary_structures SET ${assignments.join(", ")}
       WHERE id = $${values.length} RETURNING id`,
      values,
    );

    if (!updated.rows[0]) {
      return null;
    }

    if (input.sequences) {
      await applySequences(client, input.sequences);
    }

    if (input.ruleIds) {
      await replaceStructureRules(client, id, input.ruleIds);
    }

    return findStructureById(id, client);
  });
}

export async function deleteStructureById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM salary_structures WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

export async function countStructureReferences(
  id: string,
): Promise<{ contracts: number; payruns: number }> {
  const result = await pool.query<{ contracts: number; payruns: number }>(
    `SELECT
       (SELECT COUNT(*) FROM contracts WHERE salary_structure_id = $1)::int AS "contracts",
       (SELECT COUNT(*) FROM payruns WHERE structure_id = $1)::int AS "payruns"`,
    [id],
  );

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Payruns
// ---------------------------------------------------------------------------

const PAYRUN_COLUMNS = `
    r.id AS "id",
    r.name AS "name",
    r.structure_id AS "structureId",
    s.name AS "structureName",
    to_char(r.start_date, 'YYYY-MM-DD') AS "startDate",
    to_char(r.end_date, 'YYYY-MM-DD') AS "endDate",
    r.status AS "status",
    r.created_by AS "createdBy",
    cu.name AS "createdByName",
    r.computed_at AS "computedAt",
    r.validated_at AS "validatedAt",
    r.paid_at AS "paidAt",
    r.sent_at AS "sentAt",
    COALESCE(agg.count, 0)::int AS "payslipCount",
    COALESCE(agg.employee_ids, '{}'::uuid[]) AS "employeeIds",
    COALESCE(agg.gross, 0)::float8 AS "totalGross",
    COALESCE(agg.net, 0)::float8 AS "totalNet",
    COALESCE(agg.warnings, 0)::int AS "warningCount",
    COALESCE(agg.blocking, 0)::int AS "blockingCount",
    r.created_at AS "createdAt",
    r.updated_at AS "updatedAt"
`;

const PAYRUN_FROM = `
  FROM payruns r
  JOIN salary_structures s ON s.id = r.structure_id
  LEFT JOIN users cu ON cu.id = r.created_by
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::int AS count,
      array_agg(p.employee_id ORDER BY p.employee_name) AS employee_ids,
      SUM(p.gross) AS gross,
      SUM(p.net) AS net,
      SUM(jsonb_array_length(p.warnings))::int AS warnings,
      SUM((
        SELECT COUNT(*) FROM jsonb_array_elements(p.warnings) w
        WHERE (w->>'blocking')::boolean
      ))::int AS blocking
    FROM payslips p
    WHERE p.payrun_id = r.id
  ) agg ON TRUE
`;

export async function findAllPayruns(query: {
  status?: string;
  structureId?: string;
}): Promise<PayrunRecord[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.status) {
    values.push(query.status);
    conditions.push(`r.status = $${values.length}`);
  }

  if (query.structureId) {
    values.push(query.structureId);
    conditions.push(`r.structure_id = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query<PayrunRecord>(
    `SELECT ${PAYRUN_COLUMNS} ${PAYRUN_FROM} ${where}
     ORDER BY r.start_date DESC, r.created_at DESC`,
    values,
  );

  return result.rows;
}

export async function findPayrunById(
  id: string,
  db: Queryable = pool,
): Promise<PayrunRecord | null> {
  const result = await db.query<PayrunRecord>(
    `SELECT ${PAYRUN_COLUMNS} ${PAYRUN_FROM} WHERE r.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function insertPayrunWithPayslips(input: {
  name: string;
  structureId: string;
  structureName: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  employees: EligibleEmployee[];
}): Promise<PayrunRecord> {
  return withTransaction(async (client) => {
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO payruns (name, structure_id, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [input.name, input.structureId, input.startDate, input.endDate, input.createdBy],
    );
    const payrunId = inserted.rows[0].id;

    for (const employee of input.employees) {
      await client.query(
        `INSERT INTO payslips
           (payrun_id, employee_id, employee_name, employee_email, department, job_position,
            employment_type, structure_id, structure_name, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          payrunId,
          employee.employeeId,
          employee.name,
          employee.email,
          employee.department,
          employee.jobPosition,
          employee.employmentType,
          input.structureId,
          input.structureName,
          input.startDate,
          input.endDate,
        ],
      );
    }

    return (await findPayrunById(payrunId, client)) as PayrunRecord;
  });
}

export async function updatePayrunStatus(
  id: string,
  status: PayrunStatus,
  timestamps: Partial<
    Record<"computed_at" | "validated_at" | "paid_at" | "sent_at", "now" | null>
  > = {},
  db: Queryable = pool,
): Promise<void> {
  const assignments = ["status = $2", "updated_at = NOW()"];

  for (const [column, value] of Object.entries(timestamps)) {
    assignments.push(`${column} = ${value === "now" ? "NOW()" : "NULL"}`);
  }

  await db.query(`UPDATE payruns SET ${assignments.join(", ")} WHERE id = $1`, [
    id,
    status,
  ]);
}

export async function deletePayrunById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM payruns WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Payslips
// ---------------------------------------------------------------------------

const PAYSLIP_COLUMNS = `
    p.id AS "id",
    p.payrun_id AS "payrunId",
    r.name AS "payrunName",
    p.employee_id AS "employeeId",
    p.status AS "status",
    p.employee_name AS "employeeName",
    p.employee_email AS "employeeEmail",
    p.department AS "department",
    p.job_position AS "jobPosition",
    p.employment_type AS "employmentType",
    p.structure_id AS "structureId",
    p.structure_name AS "structureName",
    to_char(p.start_date, 'YYYY-MM-DD') AS "startDate",
    to_char(p.end_date, 'YYYY-MM-DD') AS "endDate",
    p.currency AS "currency",
    p.period_days::int AS "periodDays",
    p.paid_days::float8 AS "paidDays",
    p.unpaid_days::float8 AS "unpaidDays",
    p.expected_days::int AS "expectedDays",
    p.worked_days::int AS "workedDays",
    p.worked_hours::float8 AS "workedHours",
    p.overtime_hours::float8 AS "overtimeHours",
    p.basic::float8 AS "basic",
    p.allowances::float8 AS "allowances",
    p.deductions::float8 AS "deductions",
    p.contributions::float8 AS "contributions",
    p.gross::float8 AS "gross",
    p.net::float8 AS "net",
    p.lines AS "lines",
    p.warnings AS "warnings",
    p.contract_snapshot AS "contractSnapshot",
    p.bank_snapshot AS "bankSnapshot",
    p.sent_at AS "sentAt",
    p.created_at AS "createdAt",
    p.updated_at AS "updatedAt"
`;

const PAYSLIP_FROM = `
  FROM payslips p
  JOIN payruns r ON r.id = p.payrun_id
`;

export async function findAllPayslips(query: {
  status?: string;
  payrunId?: string;
  employeeId?: string;
}): Promise<PayslipRecord[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.status) {
    values.push(query.status);
    conditions.push(`p.status = $${values.length}`);
  }

  if (query.payrunId) {
    values.push(query.payrunId);
    conditions.push(`p.payrun_id = $${values.length}`);
  }

  if (query.employeeId) {
    values.push(query.employeeId);
    conditions.push(`p.employee_id = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await pool.query<PayslipRecord>(
    `SELECT ${PAYSLIP_COLUMNS} ${PAYSLIP_FROM} ${where}
     ORDER BY p.start_date DESC, p.employee_name`,
    values,
  );

  return result.rows;
}

export async function findPayslipById(id: string): Promise<PayslipRecord | null> {
  const result = await pool.query<PayslipRecord>(
    `SELECT ${PAYSLIP_COLUMNS} ${PAYSLIP_FROM} WHERE p.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findPayslipsByPayrun(
  payrunId: string,
  db: Queryable = pool,
): Promise<PayslipRecord[]> {
  const result = await db.query<PayslipRecord>(
    `SELECT ${PAYSLIP_COLUMNS} ${PAYSLIP_FROM}
     WHERE p.payrun_id = $1
     ORDER BY p.employee_name`,
    [payrunId],
  );

  return result.rows;
}

export async function writePayslipComputation(
  client: PoolClient,
  id: string,
  status: PayrunStatus,
  computed: ComputedPayslip,
): Promise<void> {
  await client.query(
    `UPDATE payslips SET
       status = $2,
       employee_name = $3,
       employee_email = $4,
       department = $5,
       job_position = $6,
       employment_type = $7,
       period_days = $8,
       paid_days = $9,
       unpaid_days = $10,
       expected_days = $11,
       worked_days = $12,
       worked_hours = $13,
       overtime_hours = $14,
       basic = $15,
       allowances = $16,
       deductions = $17,
       contributions = $18,
       gross = $19,
       net = $20,
       lines = $21::jsonb,
       warnings = $22::jsonb,
       contract_snapshot = $23::jsonb,
       bank_snapshot = $24::jsonb,
       updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      status,
      computed.employeeName,
      computed.employeeEmail,
      computed.department,
      computed.jobPosition,
      computed.employmentType,
      computed.periodDays,
      computed.paidDays,
      computed.unpaidDays,
      computed.expectedDays,
      computed.workedDays,
      computed.workedHours,
      computed.overtimeHours,
      computed.basic,
      computed.allowances,
      computed.deductions,
      computed.contributions,
      computed.gross,
      computed.net,
      JSON.stringify(computed.lines),
      JSON.stringify(computed.warnings),
      computed.contractSnapshot ? JSON.stringify(computed.contractSnapshot) : null,
      computed.bankSnapshot ? JSON.stringify(computed.bankSnapshot) : null,
    ],
  );
}

export async function updatePayslipsStatus(
  payrunId: string,
  status: PayrunStatus,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    "UPDATE payslips SET status = $2, updated_at = NOW() WHERE payrun_id = $1",
    [payrunId, status],
  );
}

export async function markPayslipsSent(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await pool.query(
    "UPDATE payslips SET sent_at = NOW(), updated_at = NOW() WHERE id = ANY($1::uuid[])",
    [ids],
  );
}

export async function deletePayslipById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM payslips WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------
// Eligibility and computation inputs
// ---------------------------------------------------------------------------

export async function findEligibleEmployees(
  structureId: string,
  startDate: string,
  endDate: string,
): Promise<EligibleEmployee[]> {
  const result = await pool.query<EligibleEmployee>(
    `SELECT
       u.id AS "employeeId",
       u.name AS "name",
       u.email AS "email",
       COALESCE(p.department, '') AS "department",
       COALESCE(p.job_position, '') AS "jobPosition",
       c.employment_type AS "employmentType",
       c.id AS "contractId",
       to_char(c.start_date, 'YYYY-MM-DD') AS "contractStartDate",
       to_char(c.end_date, 'YYYY-MM-DD') AS "contractEndDate",
       c.wage::float8 AS "wage",
       c.salary_structure_id AS "contractStructureId",
       s.name AS "contractStructureName",
       COALESCE(c.salary_structure_id = $1, FALSE) AS "structureMatches",
       ps.id AS "existingPayslipId",
       (b.employee_id IS NOT NULL) AS "hasBankDetails"
     FROM users u
     JOIN contracts c
       ON c.employee_id = u.id AND c.start_date <= $2 AND c.end_date >= $3
     LEFT JOIN salary_structures s ON s.id = c.salary_structure_id
     LEFT JOIN employee_profiles p ON p.user_id = u.id
     LEFT JOIN employee_bank_details b ON b.employee_id = u.id
     LEFT JOIN LATERAL (
       SELECT ps.id FROM payslips ps
       WHERE ps.employee_id = u.id AND ps.start_date <= $3 AND ps.end_date >= $2
       ORDER BY ps.created_at DESC LIMIT 1
     ) ps ON TRUE
     WHERE u.status = 'active'
       AND (
         SELECT COUNT(*) FROM contracts c2
         WHERE c2.employee_id = u.id AND c2.start_date <= $3 AND c2.end_date >= $2
       ) = 1
     ORDER BY u.name`,
    [structureId, startDate, endDate],
  );

  return result.rows;
}

export async function findEngineEmployees(
  ids: string[],
  db: Queryable = pool,
): Promise<EngineEmployee[]> {
  const result = await db.query<EngineEmployee>(
    `SELECT
       u.id AS "id",
       u.name AS "name",
       u.email AS "email",
       u.status AS "status",
       COALESCE(p.department, '') AS "department",
       COALESCE(p.job_position, '') AS "jobPosition"
     FROM users u
     LEFT JOIN employee_profiles p ON p.user_id = u.id
     WHERE u.id = ANY($1::uuid[])`,
    [ids],
  );

  return result.rows;
}

export async function findEngineContracts(
  ids: string[],
  db: Queryable = pool,
): Promise<EngineContract[]> {
  const result = await db.query<EngineContract>(
    `SELECT
       id AS "id",
       employee_id AS "employeeId",
       to_char(start_date, 'YYYY-MM-DD') AS "startDate",
       to_char(end_date, 'YYYY-MM-DD') AS "endDate",
       wage::float8 AS "wage",
       status AS "status",
       salary_structure_id AS "salaryStructureId",
       employment_type AS "employmentType"
     FROM contracts
     WHERE employee_id = ANY($1::uuid[])`,
    [ids],
  );

  return result.rows;
}

export async function findEngineAttendance(
  ids: string[],
  startDate: string,
  endDate: string,
  db: Queryable = pool,
): Promise<EngineAttendance[]> {
  const result = await db.query<EngineAttendance>(
    `SELECT
       employee_id AS "employeeId",
       to_char(attendance_date, 'YYYY-MM-DD') AS "attendanceDate",
       check_in::text AS "checkIn",
       check_out::text AS "checkOut",
       worked_hours::float8 AS "workedHours",
       overtime_hours::float8 AS "overtimeHours",
       status AS "status"
     FROM attendances
     WHERE employee_id = ANY($1::uuid[])
       AND attendance_date BETWEEN $2 AND $3`,
    [ids, startDate, endDate],
  );

  return result.rows;
}

export async function findEngineUnpaidLeave(
  ids: string[],
  startDate: string,
  endDate: string,
  db: Queryable = pool,
): Promise<EngineLeave[]> {
  const result = await db.query<EngineLeave>(
    `SELECT
       q.employee_id AS "employeeId",
       q.unit AS "unit",
       q.charges AS "charges"
     FROM time_off_requests q
     JOIN time_off_types t ON t.id = q.type_id
     WHERE q.employee_id = ANY($1::uuid[])
       AND q.status = 'approved'
       AND t.payroll = 'unpaid'
       AND q.start_date <= $3
       AND q.end_date >= $2`,
    [ids, startDate, endDate],
  );

  return result.rows;
}

export async function findEngineBankDetails(
  ids: string[],
  db: Queryable = pool,
): Promise<EngineBank[]> {
  const result = await db.query<EngineBank>(
    `SELECT
       employee_id AS "employeeId",
       account_holder AS "accountHolder",
       account_number AS "accountNumber",
       ifsc AS "ifsc",
       bank_name AS "bankName"
     FROM employee_bank_details
     WHERE employee_id = ANY($1::uuid[])`,
    [ids],
  );

  return result.rows;
}

export async function findOverlappingPayslips(
  ids: string[],
  startDate: string,
  endDate: string,
  db: Queryable = pool,
): Promise<EngineOverlap[]> {
  const result = await db.query<EngineOverlap>(
    `SELECT
       id AS "payslipId",
       payrun_id AS "payrunId",
       employee_id AS "employeeId",
       to_char(start_date, 'YYYY-MM-DD') AS "startDate",
       to_char(end_date, 'YYYY-MM-DD') AS "endDate"
     FROM payslips
     WHERE employee_id = ANY($1::uuid[])
       AND start_date <= $3
       AND end_date >= $2`,
    [ids, startDate, endDate],
  );

  return result.rows;
}

// ---------------------------------------------------------------------------
// Bank details
// ---------------------------------------------------------------------------

const BANK_COLUMNS = `
    b.employee_id AS "employeeId",
    b.account_holder AS "accountHolder",
    b.account_number AS "accountNumber",
    b.ifsc AS "ifsc",
    b.bank_name AS "bankName",
    b.pan AS "pan",
    b.uan AS "uan",
    b.created_at AS "createdAt",
    b.updated_at AS "updatedAt"
`;

export async function findBankDetails(
  employeeId: string,
): Promise<BankDetailsRecord | null> {
  const result = await pool.query<BankDetailsRecord>(
    `SELECT ${BANK_COLUMNS} FROM employee_bank_details b WHERE b.employee_id = $1`,
    [employeeId],
  );

  return result.rows[0] ?? null;
}

export async function upsertBankDetails(
  employeeId: string,
  input: {
    accountHolder: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    pan: string;
    uan: string;
  },
): Promise<BankDetailsRecord> {
  const result = await pool.query<BankDetailsRecord>(
    `WITH upserted AS (
       INSERT INTO employee_bank_details
         (employee_id, account_holder, account_number, ifsc, bank_name, pan, uan)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (employee_id) DO UPDATE SET
         account_holder = EXCLUDED.account_holder,
         account_number = EXCLUDED.account_number,
         ifsc = EXCLUDED.ifsc,
         bank_name = EXCLUDED.bank_name,
         pan = EXCLUDED.pan,
         uan = EXCLUDED.uan,
         updated_at = NOW()
       RETURNING *
     )
     SELECT ${BANK_COLUMNS} FROM upserted b`,
    [
      employeeId,
      input.accountHolder,
      input.accountNumber,
      input.ifsc,
      input.bankName,
      input.pan,
      input.uan,
    ],
  );

  return result.rows[0];
}

// ---------------------------------------------------------------------------
// Dashboard sources
// ---------------------------------------------------------------------------

export type DashboardEmployee = {
  id: string;
  name: string;
  department: string;
  employmentType: string | null;
  contractId: string | null;
  contractEndDate: string | null;
  salaryStructureId: string | null;
};

/** Active staff (anyone with an employee profile or a contract) with the contract that applies to the window. */
export async function findDashboardEmployees(
  from: string,
  to: string,
): Promise<DashboardEmployee[]> {
  const result = await pool.query<DashboardEmployee>(
    `SELECT
       u.id AS "id",
       u.name AS "name",
       COALESCE(p.department, '') AS "department",
       c.employment_type AS "employmentType",
       c.id AS "contractId",
       to_char(c.end_date, 'YYYY-MM-DD') AS "contractEndDate",
       c.salary_structure_id AS "salaryStructureId"
     FROM users u
     LEFT JOIN employee_profiles p ON p.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT c.* FROM contracts c
       WHERE c.employee_id = u.id AND c.start_date <= $2 AND c.end_date >= $1
       ORDER BY c.status = 'running' DESC, c.end_date DESC
       LIMIT 1
     ) c ON TRUE
     WHERE u.status = 'active'
       AND (p.user_id IS NOT NULL OR EXISTS (SELECT 1 FROM contracts x WHERE x.employee_id = u.id))
     ORDER BY u.name`,
    [from, to],
  );

  return result.rows;
}

export type DashboardPayslip = {
  id: string;
  payrunId: string;
  payrunName: string;
  payrunStatus: string;
  employeeId: string;
  employeeName: string;
  department: string;
  employmentType: string;
  status: string;
  gross: number;
  net: number;
  startDate: string;
  endDate: string;
  warnings: { code: string; message: string; blocking: boolean }[];
};

export async function findDashboardPayslips(
  from: string,
  to: string,
): Promise<DashboardPayslip[]> {
  const result = await pool.query<DashboardPayslip>(
    `SELECT
       p.id AS "id",
       p.payrun_id AS "payrunId",
       r.name AS "payrunName",
       r.status AS "payrunStatus",
       p.employee_id AS "employeeId",
       p.employee_name AS "employeeName",
       p.department AS "department",
       p.employment_type AS "employmentType",
       p.status AS "status",
       p.gross::float8 AS "gross",
       p.net::float8 AS "net",
       to_char(p.start_date, 'YYYY-MM-DD') AS "startDate",
       to_char(p.end_date, 'YYYY-MM-DD') AS "endDate",
       p.warnings AS "warnings"
     FROM payslips p
     JOIN payruns r ON r.id = p.payrun_id
     WHERE p.start_date <= $2 AND p.end_date >= $1`,
    [from, to],
  );

  return result.rows;
}

export type DashboardTrendRow = {
  month: string;
  department: string;
  employmentType: string;
  net: number;
  gross: number;
  payslips: number;
};

export async function findPaidTrend(
  fromMonth: string,
  toMonth: string,
): Promise<DashboardTrendRow[]> {
  const result = await pool.query<DashboardTrendRow>(
    `SELECT
       to_char(p.end_date, 'YYYY-MM') AS "month",
       p.department AS "department",
       p.employment_type AS "employmentType",
       SUM(p.net)::float8 AS "net",
       SUM(p.gross)::float8 AS "gross",
       COUNT(*)::int AS "payslips"
     FROM payslips p
     WHERE p.status = 'paid'
       AND to_char(p.end_date, 'YYYY-MM') BETWEEN $1 AND $2
     GROUP BY 1, 2, 3
     ORDER BY 1`,
    [fromMonth, toMonth],
  );

  return result.rows;
}

export type DashboardAttendanceRow = {
  employeeId: string;
  attendanceDate: string;
  status: string;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  late: boolean;
  overtimeHours: number;
  edited: boolean;
};

export async function findDashboardAttendance(
  ids: string[],
  from: string,
  to: string,
  timezone: string,
  workdayStart: string,
): Promise<DashboardAttendanceRow[]> {
  const result = await pool.query<DashboardAttendanceRow>(
    `SELECT
       a.employee_id AS "employeeId",
       to_char(a.attendance_date, 'YYYY-MM-DD') AS "attendanceDate",
       a.status AS "status",
       (a.check_in IS NOT NULL) AS "hasCheckIn",
       (a.check_out IS NOT NULL) AS "hasCheckOut",
       COALESCE((a.check_in AT TIME ZONE $4)::time > $5::time, FALSE) AS "late",
       a.overtime_hours::float8 AS "overtimeHours",
       (a.edited_by IS NOT NULL) AS "edited"
     FROM attendances a
     WHERE a.employee_id = ANY($1::uuid[])
       AND a.attendance_date BETWEEN $2 AND LEAST($3::date, (NOW() AT TIME ZONE $4)::date)`,
    [ids, from, to, timezone, workdayStart],
  );

  return result.rows;
}

export type DashboardLeaveRow = {
  employeeId: string;
  unit: "days" | "hours";
  payroll: "paid" | "unpaid";
  status: string;
  charges: { date: string; amount: number }[];
  consumptions: { allocationId: string; date: string; amount: number }[];
};

export async function findDashboardLeave(
  ids: string[],
  from: string,
  to: string,
): Promise<DashboardLeaveRow[]> {
  const result = await pool.query<DashboardLeaveRow>(
    `SELECT
       q.employee_id AS "employeeId",
       q.unit AS "unit",
       t.payroll AS "payroll",
       q.status AS "status",
       q.charges AS "charges",
       q.consumptions AS "consumptions"
     FROM time_off_requests q
     JOIN time_off_types t ON t.id = q.type_id
     WHERE q.employee_id = ANY($1::uuid[])
       AND q.status IN ('approved', 'pending')
       AND q.start_date <= $3
       AND q.end_date >= $2`,
    [ids, from, to],
  );

  return result.rows;
}

export type DashboardAllocationRow = {
  id: string;
  employeeId: string;
  amount: number;
  unit: "days" | "hours";
};

export async function findDashboardAllocations(
  ids: string[],
  asOf: string,
): Promise<DashboardAllocationRow[]> {
  const result = await pool.query<DashboardAllocationRow>(
    `SELECT
       a.id AS "id",
       a.employee_id AS "employeeId",
       a.amount::float8 AS "amount",
       t.unit AS "unit"
     FROM time_off_allocations a
     JOIN time_off_types t ON t.id = a.type_id
     WHERE a.employee_id = ANY($1::uuid[])
       AND a.status = 'approved'
       AND a.valid_from <= $2
       AND (a.valid_to IS NULL OR a.valid_to >= $2)`,
    [ids, asOf],
  );

  return result.rows;
}

export async function findConsumedAllocations(
  allocationIds: string[],
  asOf: string,
): Promise<Map<string, number>> {
  if (allocationIds.length === 0) {
    return new Map();
  }

  const result = await pool.query<{ allocationId: string; amount: number }>(
    `SELECT
       c->>'allocationId' AS "allocationId",
       SUM((c->>'amount')::numeric)::float8 AS "amount"
     FROM time_off_requests q,
          jsonb_array_elements(q.consumptions) c
     WHERE q.status = 'approved'
       AND c->>'allocationId' = ANY($1::text[])
       AND (c->>'date') <= $2
     GROUP BY 1`,
    [allocationIds, asOf],
  );

  return new Map(result.rows.map((row) => [row.allocationId, row.amount]));
}
