import { pool } from "../lib/db";

type PermissionCodeRow = {
  code: string;
};

export async function findPermissionCodesByRole(
  roleName: string,
): Promise<string[]> {
  const result = await pool.query<PermissionCodeRow>(
    `SELECT p.code
     FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE r.name = $1
     ORDER BY p.code`,
    [roleName],
  );

  return result.rows.map((row) => row.code);
}
