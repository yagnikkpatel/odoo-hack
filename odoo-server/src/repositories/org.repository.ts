import { pool, Queryable } from "../lib/db";
import { DepartmentRow, EmploymentTypeRow, JobPositionRow } from "../types/org";

const DEPARTMENT_SELECT = `
  SELECT d.id, d.name, d.parent_id, d.manager_id, d.active,
         m.employee_number AS manager_employee_number,
         CASE WHEN m.id IS NULL THEN NULL
              ELSE m.first_name || ' ' || m.last_name END AS manager_full_name,
         m.photo_url AS manager_photo_url,
         (SELECT COUNT(*)::text FROM employees e
           WHERE e.department_id = d.id AND e.employment_status <> 'terminated') AS employee_count
    FROM departments d
    LEFT JOIN employees m ON m.id = d.manager_id
`;

const JOB_POSITION_SELECT = `
  SELECT j.id, j.name, j.department_id, j.active,
         d.name AS department_name,
         (SELECT COUNT(*)::text FROM employees e
           WHERE e.job_position_id = j.id AND e.employment_status <> 'terminated') AS employee_count
    FROM job_positions j
    LEFT JOIN departments d ON d.id = j.department_id
`;

export async function listDepartments(
  filters: { q?: string; active?: boolean },
  db: Queryable = pool,
): Promise<DepartmentRow[]> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (filters.q) {
    values.push(`%${filters.q}%`);
    where.push(`d.name ILIKE $${values.length}`);
  }

  if (filters.active !== undefined) {
    values.push(filters.active);
    where.push(`d.active = $${values.length}`);
  }

  const result = await db.query<DepartmentRow>(
    `${DEPARTMENT_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY d.name`,
    values,
  );

  return result.rows;
}

export async function findDepartment(
  id: string,
  db: Queryable = pool,
): Promise<DepartmentRow | null> {
  const result = await db.query<DepartmentRow>(`${DEPARTMENT_SELECT} WHERE d.id = $1`, [id]);

  return result.rows[0] ?? null;
}

export async function insertDepartment(
  data: { name: string; parentId?: string | null; managerId?: string | null; active?: boolean },
  db: Queryable = pool,
): Promise<DepartmentRow> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO departments (name, parent_id, manager_id, active)
     VALUES ($1, $2, $3, COALESCE($4, TRUE))
     RETURNING id`,
    [data.name, data.parentId ?? null, data.managerId ?? null, data.active ?? null],
  );

  return (await findDepartment(result.rows[0].id, db)) as DepartmentRow;
}

export async function updateDepartment(
  id: string,
  data: { name?: string; parentId?: string | null; managerId?: string | null; active?: boolean },
  db: Queryable = pool,
): Promise<DepartmentRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [column, value] of [
    ["name", data.name],
    ["parent_id", data.parentId],
    ["manager_id", data.managerId],
    ["active", data.active],
  ] as [string, unknown][]) {
    if (value !== undefined) {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    return findDepartment(id, db);
  }

  values.push(id);

  const result = await db.query<{ id: string }>(
    `UPDATE departments SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $${values.length} RETURNING id`,
    values,
  );

  return result.rows[0] ? findDepartment(id, db) : null;
}

export async function countActiveEmployeesInDepartment(
  id: string,
  db: Queryable = pool,
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM employees
      WHERE department_id = $1 AND employment_status <> 'terminated'`,
    [id],
  );

  return Number(result.rows[0].count);
}

export async function listJobPositions(
  filters: { departmentId?: string; active?: boolean },
  db: Queryable = pool,
): Promise<JobPositionRow[]> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (filters.departmentId) {
    values.push(filters.departmentId);
    where.push(`j.department_id = $${values.length}`);
  }

  if (filters.active !== undefined) {
    values.push(filters.active);
    where.push(`j.active = $${values.length}`);
  }

  const result = await db.query<JobPositionRow>(
    `${JOB_POSITION_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY j.name`,
    values,
  );

  return result.rows;
}

export async function findJobPosition(
  id: string,
  db: Queryable = pool,
): Promise<JobPositionRow | null> {
  const result = await db.query<JobPositionRow>(`${JOB_POSITION_SELECT} WHERE j.id = $1`, [id]);

  return result.rows[0] ?? null;
}

export async function insertJobPosition(
  data: { name: string; departmentId?: string | null; active?: boolean },
  db: Queryable = pool,
): Promise<JobPositionRow> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO job_positions (name, department_id, active)
     VALUES ($1, $2, COALESCE($3, TRUE)) RETURNING id`,
    [data.name, data.departmentId ?? null, data.active ?? null],
  );

  return (await findJobPosition(result.rows[0].id, db)) as JobPositionRow;
}

export async function updateJobPosition(
  id: string,
  data: { name?: string; departmentId?: string | null; active?: boolean },
  db: Queryable = pool,
): Promise<JobPositionRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [column, value] of [
    ["name", data.name],
    ["department_id", data.departmentId],
    ["active", data.active],
  ] as [string, unknown][]) {
    if (value !== undefined) {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    return findJobPosition(id, db);
  }

  values.push(id);

  const result = await db.query<{ id: string }>(
    `UPDATE job_positions SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $${values.length} RETURNING id`,
    values,
  );

  return result.rows[0] ? findJobPosition(id, db) : null;
}

export async function countActiveEmployeesInJobPosition(
  id: string,
  db: Queryable = pool,
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM employees
      WHERE job_position_id = $1 AND employment_status <> 'terminated'`,
    [id],
  );

  return Number(result.rows[0].count);
}

export async function listEmploymentTypes(
  filters: { active?: boolean },
  db: Queryable = pool,
): Promise<EmploymentTypeRow[]> {
  const values: unknown[] = [];
  let clause = "";

  if (filters.active !== undefined) {
    values.push(filters.active);
    clause = "WHERE active = $1";
  }

  const result = await db.query<EmploymentTypeRow>(
    `SELECT id, name, code, active FROM employment_types ${clause} ORDER BY name`,
    values,
  );

  return result.rows;
}

export async function insertEmploymentType(
  data: { name: string; code: string; active?: boolean },
  db: Queryable = pool,
): Promise<EmploymentTypeRow> {
  const result = await db.query<EmploymentTypeRow>(
    `INSERT INTO employment_types (name, code, active)
     VALUES ($1, $2, COALESCE($3, TRUE))
     RETURNING id, name, code, active`,
    [data.name, data.code, data.active ?? null],
  );

  return result.rows[0];
}
