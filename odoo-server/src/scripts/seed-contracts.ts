import { seedContract } from "./lib/seed-contract";
import type { PoolClient } from "pg";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const CONTRACT_COUNT = 300;
const RUNNING_RATIO = 0.8;

const WAGE_BANDS: Record<string, [number, number]> = {
  employee: [45000, 85000],
  hr_payroll_user: [50000, 80000],
  hr_manager: [75000, 120000],
  hr_payroll_manager: [80000, 130000],
};

type UserRow = {
  id: string;
  email: string;
  role: string;
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function wageFor(role: string): number {
  const [min, max] = WAGE_BANDS[role] ?? WAGE_BANDS.employee;
  return randomInt(min, max);
}

function contractDates(forceExpired: boolean): {
  startDate: string;
  endDate: string;
  status: "running" | "expired";
} {
  const today = new Date();
  const isRunning = !forceExpired && Math.random() < RUNNING_RATIO;

  if (isRunning) {
    const start = addDays(today, -randomInt(30, 500));
    const end = addDays(today, randomInt(180, 730));
    return { startDate: formatDate(start), endDate: formatDate(end), status: "running" };
  }

  const end = addDays(today, -randomInt(10, 400));
  const start = addDays(end, -randomInt(180, 700));
  return { startDate: formatDate(start), endDate: formatDate(end), status: "expired" };
}

async function fetchRegisteredUsers(
  client: PoolClient,
  limit: number,
): Promise<UserRow[]> {
  const result = await client.query<UserRow>(
    `SELECT u.id, u.email, r.name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name <> 'admin'
     ORDER BY u.created_at
     LIMIT $1`,
    [limit],
  );

  return result.rows;
}

async function fetchEmployeesWithRunningContract(
  client: PoolClient,
): Promise<Set<string>> {
  const result = await client.query<{ employeeId: string }>(
    `SELECT employee_id AS "employeeId" FROM contracts WHERE status = 'running'`,
  );

  return new Set(result.rows.map((row) => row.employeeId));
}

async function seedContracts(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const users = await fetchRegisteredUsers(client, CONTRACT_COUNT);

    if (users.length === 0) {
      throw new Error("no registered users found to attach contracts to");
    }

    const employeesWithRunningContract = await fetchEmployeesWithRunningContract(client);

    let seeded = 0;
    for (const user of users) {
      const hasRunningContract = employeesWithRunningContract.has(user.id);
      const { startDate, endDate, status } = contractDates(hasRunningContract);

      await seedContract(client, {
        employeeId: user.id,
        startDate,
        endDate,
        wage: wageFor(user.role),
        status,
      });

      seeded++;
    }

    await client.query("COMMIT");
    logger.info(`seeded ${seeded} contracts for registered users`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seedContracts()
  .catch((error) => {
    logger.error({ err: error }, "seed-contracts failed");
    process.exit(1);
  })
  .finally(() => pool.end());
