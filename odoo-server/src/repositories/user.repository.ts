import { pool, Queryable } from "../lib/db";
import { PageParams } from "../types/common";
import { UserRow, UserWithRoleRow } from "../types/user";

const USER_WITH_ROLE_SELECT = `
  SELECT u.id, u.email, u.role_id, u.is_active, u.last_login_at,
         u.created_at, u.updated_at,
         r.name  AS role_name,
         r.label AS role_label,
         e.id    AS employee_id,
         e.employee_number,
         CASE WHEN e.id IS NULL THEN NULL
              ELSE e.first_name || ' ' || e.last_name END AS employee_full_name,
         e.photo_url AS employee_photo_url
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN employees e ON e.user_id = u.id
`;

export async function findByEmail(
  email: string,
  db: Queryable = pool,
): Promise<(UserRow & { role_name: string }) | null> {
  const result = await db.query<UserRow & { role_name: string }>(
    `SELECT u.*, r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function findById(
  id: string,
  db: Queryable = pool,
): Promise<UserWithRoleRow | null> {
  const result = await db.query<UserWithRoleRow>(
    `${USER_WITH_ROLE_SELECT} WHERE u.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findPasswordHash(
  id: string,
  db: Queryable = pool,
): Promise<string | null> {
  const result = await db.query<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = $1",
    [id],
  );

  return result.rows[0]?.password_hash ?? null;
}

export async function list(
  params: PageParams,
  filters: { roleId?: string; isActive?: boolean },
  db: Queryable = pool,
): Promise<{ rows: UserWithRoleRow[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.q) {
    values.push(`%${params.q}%`);
    where.push(`u.email ILIKE $${values.length}`);
  }

  if (filters.roleId) {
    values.push(filters.roleId);
    where.push(`u.role_id = $${values.length}`);
  }

  if (filters.isActive !== undefined) {
    values.push(filters.isActive);
    where.push(`u.is_active = $${values.length}`);
  }

  const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalResult = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users u ${clause}`,
    values,
  );

  const rowsResult = await db.query<UserWithRoleRow>(
    `${USER_WITH_ROLE_SELECT} ${clause}
      ORDER BY u.${params.sort} ${params.order.toUpperCase()}
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, params.limit, params.offset],
  );

  return { rows: rowsResult.rows, total: Number(totalResult.rows[0].count) };
}

export async function insert(
  data: { email: string; passwordHash: string; roleId: string },
  db: Queryable = pool,
): Promise<UserWithRoleRow> {
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, role_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [data.email, data.passwordHash, data.roleId],
  );

  return (await findById(inserted.rows[0].id, db)) as UserWithRoleRow;
}

export async function update(
  id: string,
  data: { roleId?: string; isActive?: boolean; passwordHash?: string },
  db: Queryable = pool,
): Promise<UserWithRoleRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];

  if (data.roleId !== undefined) {
    values.push(data.roleId);
    sets.push(`role_id = $${values.length}`);
  }

  if (data.isActive !== undefined) {
    values.push(data.isActive);
    sets.push(`is_active = $${values.length}`);
  }

  if (data.passwordHash !== undefined) {
    values.push(data.passwordHash);
    sets.push(`password_hash = $${values.length}`);
  }

  if (sets.length === 0) {
    return findById(id, db);
  }

  values.push(id);

  const result = await db.query<{ id: string }>(
    `UPDATE users SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING id`,
    values,
  );

  return result.rows[0] ? findById(result.rows[0].id, db) : null;
}

export async function touchLastLogin(id: string, db: Queryable = pool): Promise<void> {
  await db.query(
    "UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1",
    [id],
  );
}

/** BR-RBAC-6: the last active Admin must never be removable. */
export async function countActiveAdmins(db: Queryable = pool): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'admin' AND u.is_active = TRUE`,
  );

  return Number(result.rows[0].count);
}
