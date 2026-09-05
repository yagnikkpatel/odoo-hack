import { pool, Queryable } from "../lib/db";
import { PageParams } from "../types/common";
import { ContractRow, ContractWriteData } from "../types/contract";

const CONTRACT_SELECT = `
  SELECT c.id, c.reference, c.employee_id, c.start_date::text, c.end_date::text, c.status,
         c.employment_type_id, c.department_id, c.job_position_id,
         c.working_schedule_id, c.salary_structure_id,
         c.wage::text, c.wage_type, c.currency_code, c.notes,
         c.created_at, c.updated_at,
         (c.status = 'running'
            AND c.start_date <= CURRENT_DATE
            AND (c.end_date IS NULL OR c.end_date >= CURRENT_DATE)) AS is_active_now,
         e.employee_number,
         e.first_name || ' ' || e.last_name AS employee_full_name,
         e.photo_url AS employee_photo_url,
         et.name AS employment_type_name, et.code AS employment_type_code,
         d.name  AS department_name,
         j.name  AS job_position_name,
         ws.name AS working_schedule_name,
         ws.hours_per_week::text AS working_schedule_hours,
         ss.name AS salary_structure_name
    FROM contracts c
    JOIN employees          e  ON e.id  = c.employee_id
    JOIN employment_types   et ON et.id = c.employment_type_id
    JOIN working_schedules  ws ON ws.id = c.working_schedule_id
    JOIN salary_structures  ss ON ss.id = c.salary_structure_id
    LEFT JOIN departments   d  ON d.id  = c.department_id
    LEFT JOIN job_positions j  ON j.id  = c.job_position_id
`;

const COLUMNS: Record<keyof ContractWriteData, string> = {
  employee_id: "employee_id",
  start_date: "start_date",
  end_date: "end_date",
  employment_type_id: "employment_type_id",
  department_id: "department_id",
  job_position_id: "job_position_id",
  working_schedule_id: "working_schedule_id",
  salary_structure_id: "salary_structure_id",
  wage: "wage",
  wage_type: "wage_type",
  notes: "notes",
};

export async function findById(
  id: string,
  db: Queryable = pool,
): Promise<ContractRow | null> {
  const result = await db.query<ContractRow>(`${CONTRACT_SELECT} WHERE c.id = $1`, [id]);

  return result.rows[0] ?? null;
}

export async function list(
  params: PageParams,
  filters: {
    employeeId?: string;
    status?: string;
    departmentId?: string;
    employmentTypeId?: string;
    activeOn?: string;
  },
  db: Queryable = pool,
): Promise<{ rows: ContractRow[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.q) {
    values.push(`%${params.q}%`);
    where.push(
      `(c.reference ILIKE $${values.length}
        OR e.first_name ILIKE $${values.length}
        OR e.last_name ILIKE $${values.length}
        OR e.employee_number ILIKE $${values.length})`,
    );
  }

  for (const [column, value] of [
    ["c.employee_id", filters.employeeId],
    ["c.status", filters.status],
    ["c.department_id", filters.departmentId],
    ["c.employment_type_id", filters.employmentTypeId],
  ] as [string, string | undefined][]) {
    if (value) {
      values.push(value);
      where.push(`${column} = $${values.length}`);
    }
  }

  if (filters.activeOn) {
    values.push(filters.activeOn);
    where.push(
      `(c.start_date <= $${values.length}
        AND (c.end_date IS NULL OR c.end_date >= $${values.length}))`,
    );
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM contracts c JOIN employees e ON e.id = c.employee_id ${clause}`,
    values,
  );

  const rows = await db.query<ContractRow>(
    `${CONTRACT_SELECT} ${clause}
      ORDER BY c.${params.sort} ${params.order.toUpperCase()}, c.id
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, params.limit, params.offset],
  );

  return { rows: rows.rows, total: Number(total.rows[0].count) };
}

/**
 * BR-CON-5: the contract applicable to a payroll period. The no-overlap constraint guarantees
 * this resolves to zero or one row — the LIMIT is belt and braces, not a tie-break.
 */
export async function findApplicable(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  db: Queryable = pool,
): Promise<ContractRow | null> {
  const result = await db.query<ContractRow>(
    `${CONTRACT_SELECT}
      WHERE c.employee_id = $1
        AND c.status = 'running'
        AND c.start_date <= $3
        AND (c.end_date IS NULL OR c.end_date >= $2)
      ORDER BY c.start_date DESC
      LIMIT 1`,
    [employeeId, periodStart, periodEnd],
  );

  return result.rows[0] ?? null;
}

/** Used to name the conflicting contract when the EXCLUDE constraint fires (BR-CON-1). */
export async function findOverlapping(
  employeeId: string,
  startDate: string,
  endDate: string | null,
  excludeId: string | null,
  db: Queryable = pool,
): Promise<ContractRow | null> {
  const result = await db.query<ContractRow>(
    `${CONTRACT_SELECT}
      WHERE c.employee_id = $1
        AND c.status IN ('running', 'expired')
        AND ($4::uuid IS NULL OR c.id <> $4)
        AND daterange(c.start_date, COALESCE(c.end_date, 'infinity'::date), '[]')
            && daterange($2::date, COALESCE($3::date, 'infinity'::date), '[]')
      LIMIT 1`,
    [employeeId, startDate, endDate, excludeId],
  );

  return result.rows[0] ?? null;
}

export async function insert(
  reference: string,
  data: ContractWriteData,
  db: Queryable,
): Promise<ContractRow> {
  const columns = ["reference"];
  const placeholders = ["$1"];
  const values: unknown[] = [reference];

  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = data[key as keyof ContractWriteData];

    if (value !== undefined) {
      values.push(value);
      columns.push(column);
      placeholders.push(`$${values.length}`);
    }
  }

  const result = await db.query<{ id: string }>(
    `INSERT INTO contracts (${columns.join(", ")})
     VALUES (${placeholders.join(", ")}) RETURNING id`,
    values,
  );

  return (await findById(result.rows[0].id, db)) as ContractRow;
}

export async function update(
  id: string,
  data: ContractWriteData,
  db: Queryable = pool,
): Promise<ContractRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = data[key as keyof ContractWriteData];

    if (value !== undefined) {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    return findById(id, db);
  }

  values.push(id);

  await db.query(
    `UPDATE contracts SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`,
    values,
  );

  return findById(id, db);
}

export async function setStatus(
  id: string,
  status: string,
  db: Queryable = pool,
): Promise<ContractRow | null> {
  await db.query(
    "UPDATE contracts SET status = $2, updated_at = NOW() WHERE id = $1",
    [id, status],
  );

  return findById(id, db);
}

export async function remove(id: string, db: Queryable = pool): Promise<void> {
  await db.query("DELETE FROM contracts WHERE id = $1", [id]);
}

/** Expiring rather than deleting keeps the history a terminated employee's payslips need. */
export async function expireRunningForEmployee(
  employeeId: string,
  onDate: string,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `UPDATE contracts
        SET status = 'expired',
            end_date = LEAST(COALESCE(end_date, $2::date), $2::date),
            updated_at = NOW()
      WHERE employee_id = $1 AND status = 'running'`,
    [employeeId, onDate],
  );
}

export async function countForEmployee(
  employeeId: string,
  db: Queryable = pool,
): Promise<number> {
  const result = await db.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM contracts WHERE employee_id = $1",
    [employeeId],
  );

  return Number(result.rows[0].count);
}
