import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../app";
import { pool } from "../lib/db";
import { redis } from "../lib/redis";
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

export async function cleanup(): Promise<void> {
  await pool.query("DELETE FROM users WHERE email LIKE $1", [`${TEST_PREFIX}%`]);
}

export async function shutdown(): Promise<void> {
  await cleanup();
  await pool.end();
  redis.disconnect();
}
