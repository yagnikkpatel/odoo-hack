import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../app";
import { pool } from "../lib/db";
import { redis } from "../lib/redis";
import { closeQueues } from "../queues/deleteCloudinaryImage.queue";
import { RoleName } from "../types/user";

export const app = createApp();

/**
 * Every account a test creates carries this prefix so cleanup can find them. The pid is part
 * of it because `node --test` runs each file in its own process against the same database —
 * without it, one file's cleanup deletes another file's users mid-run.
 */
export const TEST_PREFIX = `pp360-test-${process.pid}-`;

export async function createTestUser(
  role: RoleName,
  options: { active?: boolean; password?: string } = {},
): Promise<{ id: string; email: string; password: string }> {
  const password = options.password ?? "TestPass@123";
  const email = `${TEST_PREFIX}${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;

  const result = await pool.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, role_id, is_active)
     VALUES ($1, $2, (SELECT id FROM roles WHERE name = $3), $4)
     RETURNING id`,
    [email, await bcrypt.hash(password, 4), role, options.active ?? true],
  );

  return { id: result.rows[0].id, email, password };
}

export async function tokenFor(role: RoleName): Promise<string> {
  const user = await createTestUser(role);

  return login(user.email, user.password);
}

export async function login(email: string, password: string): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({ email, password });

  if (response.status !== 200) {
    throw new Error(`login failed (${response.status}): ${JSON.stringify(response.body)}`);
  }

  return response.body.data.accessToken;
}

export function auth(token: string): [string, string] {
  return ["Authorization", `Bearer ${token}`];
}

export async function roleId(name: RoleName): Promise<string> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM roles WHERE name = $1",
    [name],
  );

  return result.rows[0].id;
}

/** Fixtures are tagged with the pid-scoped prefix so parallel test files never collide. */
export async function createTestEmployee(
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; employee_number: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const columns = ["employee_number", "first_name", "last_name"];
  const values: unknown[] = [
    `${TEST_PREFIX}${suffix}`,
    String(overrides.first_name ?? "Test"),
    String(overrides.last_name ?? "Employee"),
  ];

  for (const [key, value] of Object.entries(overrides)) {
    if (key !== "first_name" && key !== "last_name") {
      columns.push(key);
      values.push(value);
    }
  }

  const result = await pool.query<{ id: string; employee_number: string }>(
    `INSERT INTO employees (${columns.join(", ")})
     VALUES (${columns.map((_, i) => `$${i + 1}`).join(", ")})
     RETURNING id, employee_number`,
    values,
  );

  return result.rows[0];
}

export async function createTestDepartment(name?: string): Promise<{ id: string; name: string }> {
  const result = await pool.query<{ id: string; name: string }>(
    "INSERT INTO departments (name) VALUES ($1) RETURNING id, name",
    [name ?? `${TEST_PREFIX}dept-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`],
  );

  return result.rows[0];
}

export async function cleanup(): Promise<void> {
  // Employees first: users.id is referenced by employees.user_id.
  await pool.query("DELETE FROM employees WHERE employee_number LIKE $1", [`${TEST_PREFIX}%`]);
  await pool.query("DELETE FROM job_positions WHERE name LIKE $1", [`${TEST_PREFIX}%`]);
  await pool.query("DELETE FROM departments WHERE name LIKE $1", [`${TEST_PREFIX}%`]);
  await pool.query("DELETE FROM employment_types WHERE code LIKE $1", [`${TEST_PREFIX.toUpperCase().replace(/-/g, "_")}%`]);
  await pool.query("DELETE FROM users WHERE email LIKE $1", [`${TEST_PREFIX}%`]);
}

export async function shutdown(): Promise<void> {
  await cleanup();
  await closeQueues();
  await pool.end();
  redis.disconnect();
}
