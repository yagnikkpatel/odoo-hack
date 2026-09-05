import { pool, Queryable } from "../lib/db";
import { PageParams } from "../types/common";
import { EmployeeRow, EmployeeWriteData } from "../types/employee";

/**
 * `has_running_contract` is FALSE until Phase 2 creates the contracts table; the subquery is
 * added there rather than shipping a column the API promises but cannot populate.
 */
const EMPLOYEE_SELECT = `
  SELECT e.*,
         d.name AS department_name,
         j.name AS job_position_name,
         m.employee_number AS manager_employee_number,
         CASE WHEN m.id IS NULL THEN NULL
              ELSE m.first_name || ' ' || m.last_name END AS manager_full_name,
         m.photo_url AS manager_photo_url,
         ws.name AS working_schedule_name,
         ws.hours_per_week::text AS working_schedule_hours,
         FALSE AS has_running_contract
    FROM employees e
    LEFT JOIN departments      d  ON d.id  = e.department_id
    LEFT JOIN job_positions    j  ON j.id  = e.job_position_id
    LEFT JOIN employees        m  ON m.id  = e.manager_id
    LEFT JOIN working_schedules ws ON ws.id = e.working_schedule_id
`;

const COLUMNS: Record<keyof EmployeeWriteData, string> = {
  first_name: "first_name",
  last_name: "last_name",
  work_email: "work_email",
  personal_email: "personal_email",
  work_phone: "work_phone",
  mobile_phone: "mobile_phone",
  date_of_birth: "date_of_birth",
  gender: "gender",
  marital_status: "marital_status",
  address_line1: "address_line1",
  address_line2: "address_line2",
  city: "city",
  state: "state",
  postal_code: "postal_code",
  country: "country",
  emergency_contact_name: "emergency_contact_name",
  emergency_contact_phone: "emergency_contact_phone",
  department_id: "department_id",
  job_position_id: "job_position_id",
  manager_id: "manager_id",
  working_schedule_id: "working_schedule_id",
  employment_status: "employment_status",
  hire_date: "hire_date",
  bank_name: "bank_name",
  bank_account_number: "bank_account_number",
  bank_ifsc: "bank_ifsc",
  tax_identification_number: "tax_identification_number",
};

export async function findById(
  id: string,
  db: Queryable = pool,
): Promise<EmployeeRow | null> {
  const result = await db.query<EmployeeRow>(`${EMPLOYEE_SELECT} WHERE e.id = $1`, [id]);

  return result.rows[0] ?? null;
}

export async function findByUserId(
  userId: string,
  db: Queryable = pool,
): Promise<EmployeeRow | null> {
  const result = await db.query<EmployeeRow>(`${EMPLOYEE_SELECT} WHERE e.user_id = $1`, [userId]);

  return result.rows[0] ?? null;
}

export type EmployeeFilters = {
  departmentId?: string;
  jobPositionId?: string;
  managerId?: string;
  employmentStatus?: string;
  /** Set when the caller may only see their own record (BR-RBAC-2). */
  onlyId?: string;
};

export async function list(
  params: PageParams,
  filters: EmployeeFilters,
  db: Queryable = pool,
): Promise<{ rows: EmployeeRow[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (filters.onlyId) {
    values.push(filters.onlyId);
    where.push(`e.id = $${values.length}`);
  }

  if (params.q) {
    values.push(`%${params.q}%`);
    where.push(
      `(e.first_name ILIKE $${values.length} OR e.last_name ILIKE $${values.length}
        OR e.employee_number ILIKE $${values.length} OR e.work_email ILIKE $${values.length})`,
    );
  }

  for (const [column, value] of [
    ["e.department_id", filters.departmentId],
    ["e.job_position_id", filters.jobPositionId],
    ["e.manager_id", filters.managerId],
    ["e.employment_status", filters.employmentStatus],
  ] as [string, string | undefined][]) {
    if (value) {
      values.push(value);
      where.push(`${column} = $${values.length}`);
    }
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const totalResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM employees e ${clause}`,
    values,
  );

  const rowsResult = await db.query<EmployeeRow>(
    `${EMPLOYEE_SELECT} ${clause}
      ORDER BY e.${params.sort} ${params.order.toUpperCase()}, e.id
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, params.limit, params.offset],
  );

  return { rows: rowsResult.rows, total: Number(totalResult.rows[0].count) };
}

export async function insert(
  employeeNumber: string,
  data: EmployeeWriteData,
  db: Queryable,
): Promise<EmployeeRow> {
  const columns = ["employee_number"];
  const placeholders = ["$1"];
  const values: unknown[] = [employeeNumber];

  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = data[key as keyof EmployeeWriteData];

    if (value !== undefined) {
      values.push(value);
      columns.push(column);
      placeholders.push(`$${values.length}`);
    }
  }

  const result = await db.query<{ id: string }>(
    `INSERT INTO employees (${columns.join(", ")})
     VALUES (${placeholders.join(", ")}) RETURNING id`,
    values,
  );

  return (await findById(result.rows[0].id, db)) as EmployeeRow;
}

export async function update(
  id: string,
  data: EmployeeWriteData,
  db: Queryable = pool,
): Promise<EmployeeRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(COLUMNS)) {
    const value = data[key as keyof EmployeeWriteData];

    if (value !== undefined) {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    return findById(id, db);
  }

  values.push(id);

  const result = await db.query<{ id: string }>(
    `UPDATE employees SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $${values.length} RETURNING id`,
    values,
  );

  return result.rows[0] ? findById(id, db) : null;
}

export async function terminate(
  id: string,
  terminationDate: string,
  db: Queryable = pool,
): Promise<void> {
  await db.query(
    `UPDATE employees
        SET employment_status = 'terminated', termination_date = $2, updated_at = NOW()
      WHERE id = $1`,
    [id, terminationDate],
  );
}

/** Returns the asset it replaced, so the caller can queue that one for deletion. */
export async function setPhoto(
  id: string,
  photo: { url: string; publicId: string },
  db: Queryable = pool,
): Promise<{ previousPublicId: string | null }> {
  // Read before write: RETURNING sees post-update values, so it cannot hand back the old id.
  const before = await db.query<{ photo_public_id: string | null }>(
    "SELECT photo_public_id FROM employees WHERE id = $1",
    [id],
  );

  await db.query(
    `UPDATE employees SET photo_url = $2, photo_public_id = $3, updated_at = NOW()
      WHERE id = $1`,
    [id, photo.url, photo.publicId],
  );

  return { previousPublicId: before.rows[0]?.photo_public_id ?? null };
}

export async function findWorkEmailOwner(
  workEmail: string,
  db: Queryable = pool,
): Promise<string | null> {
  const result = await db.query<{ id: string }>(
    "SELECT id FROM employees WHERE lower(work_email) = lower($1)",
    [workEmail],
  );

  return result.rows[0]?.id ?? null;
}

/** Walks up the manager chain to prove adding this edge would not create a loop (BR-EMP-3). */
export async function managerChainContains(
  startManagerId: string,
  target: string,
  db: Queryable = pool,
): Promise<boolean> {
  const result = await db.query<{ found: boolean }>(
    `WITH RECURSIVE chain AS (
        SELECT id, manager_id FROM employees WHERE id = $1
        UNION ALL
        SELECT e.id, e.manager_id FROM employees e JOIN chain c ON e.id = c.manager_id
     )
     SELECT EXISTS (SELECT 1 FROM chain WHERE id = $2) AS found`,
    [startManagerId, target],
  );

  return result.rows[0].found;
}

export async function linkUser(
  employeeId: string,
  userId: string | null,
  db: Queryable = pool,
): Promise<void> {
  await db.query("UPDATE employees SET user_id = $2, updated_at = NOW() WHERE id = $1", [
    employeeId,
    userId,
  ]);
}

export async function findByUserIdSlim(
  userId: string,
  db: Queryable = pool,
): Promise<{ id: string; employee_number: string; full_name: string; photo_url: string | null } | null> {
  const result = await db.query<{
    id: string;
    employee_number: string;
    full_name: string;
    photo_url: string | null;
  }>(
    `SELECT id, employee_number, first_name || ' ' || last_name AS full_name, photo_url
       FROM employees WHERE user_id = $1`,
    [userId],
  );

  return result.rows[0] ?? null;
}
