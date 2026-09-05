import bcrypt from "bcryptjs";
import { z } from "zod";
import type { PoolClient } from "pg";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const adminSeedSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(8),
  roleName: z.string().min(1),
});

type AdminSeed = z.infer<typeof adminSeedSchema>;

type RoleRow = {
  id: string;
};

type UserRow = {
  id: string;
  email: string;
};

const SALT_ROUNDS = 12;

function loadAdminSeed(): AdminSeed {
  const parsed = adminSeedSchema.safeParse({
    email: process.env.SEED_ADMIN_EMAIL,
    password: process.env.SEED_ADMIN_PASSWORD,
    roleName: process.env.SEED_ADMIN_ROLE,
  });

  if (!parsed.success) {
    throw new Error(
      `invalid admin seed env variables:\n${z.prettifyError(parsed.error)}`,
    );
  }

  return parsed.data;
}

async function resolveRoleId(
  client: PoolClient,
  roleName: string,
): Promise<string> {
  const result = await client.query<RoleRow>(
    "SELECT id FROM roles WHERE name = $1",
    [roleName],
  );

  const role = result.rows[0];

  if (!role) {
    throw new Error(`role not found: ${roleName}`);
  }

  return role.id;
}

async function upsertAdmin(
  client: PoolClient,
  adminSeed: AdminSeed,
  roleId: string,
): Promise<UserRow> {
  const passwordHash = await bcrypt.hash(adminSeed.password, SALT_ROUNDS);

  const result = await client.query<UserRow>(
    `INSERT INTO users (email, password_hash, role_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role_id = EXCLUDED.role_id
     RETURNING id, email`,
    [adminSeed.email, passwordHash, roleId],
  );

  return result.rows[0];
}

async function seed(): Promise<void> {
  const adminSeed = loadAdminSeed();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const roleId = await resolveRoleId(client, adminSeed.roleName);
    const admin = await upsertAdmin(client, adminSeed, roleId);

    await client.query("COMMIT");

    logger.info(`admin seeded: ${admin.email}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .catch((error) => {
    logger.error({ err: error }, "seed failed");
    process.exit(1);
  })
  .finally(() => pool.end());
