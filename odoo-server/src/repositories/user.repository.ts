import { pool } from "../lib/db";
import { UserAuthRecord, UserRecord } from "../types/user";

type RoleRow = {
  id: string;
};

type DeletedRow = {
  id: string;
};

const USER_COLUMNS =
  "u.id, u.name, u.email, r.name AS role, u.status, u.created_at, u.updated_at";

export async function findRoleIdByName(name: string): Promise<string | null> {
  const result = await pool.query<RoleRow>(
    "SELECT id FROM roles WHERE name = $1",
    [name],
  );

  return result.rows[0]?.id ?? null;
}

export async function findAllUsers(): Promise<UserRecord[]> {
  const result = await pool.query<UserRecord>(
    `SELECT ${USER_COLUMNS}
     FROM users u
     JOIN roles r ON r.id = u.role_id
     ORDER BY u.created_at DESC`,
  );

  return result.rows;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const result = await pool.query<UserRecord>(
    `SELECT ${USER_COLUMNS}
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findAuthUserByEmail(
  email: string,
): Promise<UserAuthRecord | null> {
  const result = await pool.query<UserAuthRecord>(
    `SELECT u.id, u.email, r.name AS role, u.status, u.password_hash
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function insertUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  roleId: string;
  status: string;
}): Promise<UserRecord> {
  const result = await pool.query<UserRecord>(
    `WITH inserted AS (
       INSERT INTO users (name, email, password_hash, role_id, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *
     )
     SELECT u.id, u.name, u.email, r.name AS role, u.status, u.created_at, u.updated_at
     FROM inserted u
     JOIN roles r ON r.id = u.role_id`,
    [input.name, input.email, input.passwordHash, input.roleId, input.status],
  );

  return result.rows[0];
}

export async function updateUser(
  id: string,
  input: {
    name?: string;
    email?: string;
    status?: string;
    roleId?: string;
  },
): Promise<UserRecord | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  if (input.name !== undefined) {
    values.push(input.name);
    assignments.push(`name = $${values.length}`);
  }

  if (input.email !== undefined) {
    values.push(input.email);
    assignments.push(`email = $${values.length}`);
  }

  if (input.status !== undefined) {
    values.push(input.status);
    assignments.push(`status = $${values.length}`);
  }

  if (input.roleId !== undefined) {
    values.push(input.roleId);
    assignments.push(`role_id = $${values.length}`);
  }

  assignments.push("updated_at = NOW()");
  values.push(id);

  const result = await pool.query<UserRecord>(
    `WITH updated AS (
       UPDATE users
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING *
     )
     SELECT u.id, u.name, u.email, r.name AS role, u.status, u.created_at, u.updated_at
     FROM updated u
     JOIN roles r ON r.id = u.role_id`,
    values,
  );

  return result.rows[0] ?? null;
}

export async function deleteUserById(id: string): Promise<string | null> {
  const result = await pool.query<DeletedRow>(
    "DELETE FROM users WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}
