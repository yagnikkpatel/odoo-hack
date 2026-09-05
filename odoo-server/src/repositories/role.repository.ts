import { pool, Queryable } from "../lib/db";
import { RoleRow } from "../types/user";

export async function listWithCounts(db: Queryable = pool): Promise<RoleRow[]> {
  const result = await db.query<RoleRow>(
    `SELECT r.id, r.name, r.label,
            (SELECT COUNT(*)::text FROM role_permissions rp WHERE rp.role_id = r.id) AS permission_count,
            (SELECT COUNT(*)::text FROM users u           WHERE u.role_id  = r.id) AS user_count
       FROM roles r
      ORDER BY r.name`,
  );

  return result.rows;
}

export async function findById(id: string, db: Queryable = pool): Promise<RoleRow | null> {
  const result = await db.query<RoleRow>(
    "SELECT id, name, label FROM roles WHERE id = $1",
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findByName(
  name: string,
  db: Queryable = pool,
): Promise<RoleRow | null> {
  const result = await db.query<RoleRow>(
    "SELECT id, name, label FROM roles WHERE name = $1",
    [name],
  );

  return result.rows[0] ?? null;
}
