import { AppError } from '../errors/AppError';
import { pool } from '../lib/db';

const ROLE_NAMES = ['employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'];
type RoleRow = { id: string; name: string; permissions: string[] };
export type RoleChange = { role: string; permissions: string[]; expectedPermissions: string[] };

function permissionList(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 200 || value.some(code => typeof code !== 'string' || !/^[a-z_]+(?::[a-z_]+){1,2}$/.test(code))) {
    throw new AppError(400, 'Provide a valid permission list.');
  }
  if (new Set(value).size !== value.length) throw new AppError(400, 'Permissions must not be repeated.');
  return [...value].sort();
}

export function parseRoleChanges(input: unknown): RoleChange[] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AppError(400, 'Provide the role changes.');
  const record = input as Record<string, unknown>;
  if (Object.keys(record).some(key => key !== 'changes') || !Array.isArray(record.changes) || record.changes.length < 1 || record.changes.length > 4) {
    throw new AppError(400, 'Choose between one and four roles to update.');
  }
  const changes = record.changes.map((value: unknown): RoleChange => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'Provide a valid role change.');
    const change = value as Record<string, unknown>;
    if (Object.keys(change).some(key => !['role', 'permissions', 'expectedPermissions'].includes(key)) || typeof change.role !== 'string' || !ROLE_NAMES.includes(change.role)) {
      throw new AppError(400, 'Choose an editable role. Admin access is protected.');
    }
    const permissions = permissionList(change.permissions);
    if (permissions.some(code => code.startsWith('user:') || code.startsWith('role:'))) {
      throw new AppError(400, 'Account and permission administration are reserved for Admin.');
    }
    return { role: change.role, permissions, expectedPermissions: permissionList(change.expectedPermissions) };
  });
  if (new Set(changes.map(change => change.role)).size !== changes.length) throw new AppError(400, 'Each role may appear only once.');
  return changes;
}

export async function getRoleConfiguration() {
  const permissions = await pool.query<{ code: string; description: string }>('SELECT code, description FROM permissions ORDER BY code');
  const roles = await pool.query<RoleRow>(`SELECT r.id, r.name, COALESCE(array_agg(p.code ORDER BY p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
    FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id LEFT JOIN permissions p ON p.id = rp.permission_id
    GROUP BY r.id, r.name ORDER BY r.name`);
  return {
    permissions: permissions.rows.map(permission => ({ code: permission.code, label: permission.description })),
    roles: roles.rows.map(role => {
      if (role.name === 'admin') return { name: role.name, permissions: permissions.rows.map(permission => permission.code), editable: false };
      return { name: role.name, permissions: role.permissions, editable: ROLE_NAMES.includes(role.name) };
    }),
  };
}

export async function saveRoleChanges(changes: RoleChange[]) {
  changes = parseRoleChanges({ changes });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roles = await client.query<{ id: string; name: string }>('SELECT id, name FROM roles WHERE name = ANY($1::text[]) ORDER BY name FOR UPDATE', [changes.map(change => change.role)]);
    if (roles.rows.length !== changes.length) throw new AppError(404, 'A selected role no longer exists.');
    const catalog = await client.query<{ id: string; code: string }>('SELECT id, code FROM permissions');
    const known = new Set(catalog.rows.map(permission => permission.code));
    for (const change of changes) {
      if (change.permissions.some(code => !known.has(code))) throw new AppError(400, 'An unknown permission was selected.');
      const role = roles.rows.find(role => role.name === change.role)!;
      const current = await client.query<{ code: string }>('SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = $1 ORDER BY p.code', [role.id]);
      const actual = current.rows.map(permission => permission.code);
      if (JSON.stringify(actual) === JSON.stringify(change.permissions)) continue;
      if (JSON.stringify(actual) !== JSON.stringify(change.expectedPermissions)) throw new AppError(409, 'Permissions changed in another session. Reload the matrix before saving.');
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [role.id]);
      await client.query('INSERT INTO role_permissions (role_id, permission_id) SELECT $1, id FROM permissions WHERE code = ANY($2::text[])', [role.id, change.permissions]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return getRoleConfiguration();
}
