import bcrypt from "bcryptjs";
import { z } from "zod";
import type { PoolClient } from "pg";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const SALT_ROUNDS = 12;

const adminSeedSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(8),
  roleName: z.string().min(1),
});

type AdminSeed = z.infer<typeof adminSeedSchema>;

/**
 * Demo accounts, one per role, so the permission matrix can be exercised by hand.
 * Only created when SEED_DEMO_USERS=true — never in production.
 */
const DEMO_ROLES = [
  "employee",
  "hr_manager",
  "hr_payroll_user",
  "hr_payroll_manager",
] as const;

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

async function resolveRoleId(client: PoolClient, roleName: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    "SELECT id FROM roles WHERE name = $1",
    [roleName],
  );

  const role = result.rows[0];

  if (!role) {
    throw new Error(`role not found: ${roleName} — run "npm run migrate" first`);
  }

  return role.id;
}

async function upsertUser(
  client: PoolClient,
  email: string,
  password: string,
  roleId: string,
): Promise<string> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const result = await client.query<{ email: string }>(
    `INSERT INTO users (email, password_hash, role_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           role_id       = EXCLUDED.role_id,
           is_active     = TRUE,
           updated_at    = NOW()
     RETURNING email`,
    [email, passwordHash, roleId],
  );

  return result.rows[0].email;
}

async function seed(): Promise<void> {
  const adminSeed = loadAdminSeed();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const adminRoleId = await resolveRoleId(client, adminSeed.roleName);
    const admin = await upsertUser(
      client,
      adminSeed.email,
      adminSeed.password,
      adminRoleId,
    );

    logger.info(`admin seeded: ${admin}`);

    if (process.env.SEED_DEMO_USERS === "true") {
      const password = process.env.SEED_DEMO_PASSWORD ?? adminSeed.password;

      for (const roleName of DEMO_ROLES) {
        const roleId = await resolveRoleId(client, roleName);
        const email = await upsertUser(
          client,
          `${roleName.replace(/_/g, "-")}@peoplepay360.test`,
          password,
          roleId,
        );

        logger.info(`demo user seeded: ${email} (${roleName})`);
      }
    }

    await client.query("COMMIT");
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
