import { pool, Queryable } from "../lib/db";
import { PermissionRow } from "../types/user";

export async function list(
  filters: { module?: string },
  db: Queryable = pool,
): Promise<PermissionRow[]> {
  const values: unknown[] = [];
  let clause = "";

  if (filters.module) {
    values.push(filters.module);
    clause = "WHERE module = $1";
  }

  const result = await db.query<PermissionRow>(
    `SELECT id, code, module, description FROM permissions ${clause}
      ORDER BY module, code`,
    values,
  );

  return result.rows;
}

export async function findByRole(
  roleId: string,
  db: Queryable = pool,
): Promise<PermissionRow[]> {
  const result = await db.query<PermissionRow>(
    `SELECT p.id, p.code, p.module, p.description
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.module, p.code`,
    [roleId],
  );

  return result.rows;
}

export async function findByCodes(
  codes: string[],
  db: Queryable = pool,
): Promise<PermissionRow[]> {
  const result = await db.query<PermissionRow>(
    "SELECT id, code, module, description FROM permissions WHERE code = ANY($1::text[])",
    [codes],
  );

  return result.rows;
}

/** Wholesale replace, inside the caller's transaction (BR-X-7). */
export async function replaceRolePermissions(
  roleId: string,
  permissionIds: string[],
  db: Queryable,
): Promise<void> {
  await db.query("DELETE FROM role_permissions WHERE role_id = $1", [roleId]);

  if (permissionIds.length > 0) {
    await db.query(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT $1, unnest($2::uuid[])`,
      [roleId, permissionIds],
    );
  }
}
