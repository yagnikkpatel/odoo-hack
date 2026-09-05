import type { PoolClient } from "pg";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const RECORD_COUNT = 300;
const EMPLOYEE_POOL_SIZE = 60;
const DATES_PER_EMPLOYEE = RECORD_COUNT / EMPLOYEE_POOL_SIZE;
const WINDOW_DAYS = 60;

type UserRow = {
  id: string;
};

type AttendanceOutcome = {
  checkIn: Date | null;
  checkOut: Date | null;
  overtimeHours: number;
  status: "present" | "incomplete" | "absent";
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dayAt(daysAgo: number, hour: number, minute: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date;
}

// attendance_date is a plain DATE column: format it from local calendar
// fields, not toISOString(), which would shift it a day off in +offset zones.
function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function distinctDaysAgo(count: number, windowDays: number): number[] {
  const pool = Array.from({ length: windowDays }, (_, index) => index);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function attendanceOutcome(daysAgo: number): AttendanceOutcome {
  const roll = Math.random();

  if (roll < 0.15) {
    return { checkIn: null, checkOut: null, overtimeHours: 0, status: "absent" };
  }

  const checkIn = dayAt(daysAgo, 9, randomInt(-15, 15));

  if (roll < 0.3) {
    return { checkIn, checkOut: null, overtimeHours: 0, status: "incomplete" };
  }

  const workedHours = randomInt(70, 105) / 10;
  const checkOut = new Date(checkIn.getTime() + workedHours * 3_600_000);
  const overtimeHours = Math.max(0, Math.round((workedHours - 8) * 100) / 100);

  return { checkIn, checkOut, overtimeHours, status: "present" };
}

async function fetchEmployeePool(
  client: PoolClient,
  limit: number,
): Promise<UserRow[]> {
  const result = await client.query<UserRow>(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name <> 'admin'
     ORDER BY u.created_at
     LIMIT $1`,
    [limit],
  );

  return result.rows;
}

async function insertAttendance(
  client: PoolClient,
  params: {
    employeeId: string;
    attendanceDate: string;
    checkIn: Date | null;
    checkOut: Date | null;
    overtimeHours: number;
    status: string;
  },
): Promise<boolean> {
  const result = await client.query(
    `INSERT INTO attendances (employee_id, attendance_date, check_in, check_out, overtime_hours, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (employee_id, attendance_date) DO NOTHING`,
    [
      params.employeeId,
      params.attendanceDate,
      params.checkIn,
      params.checkOut,
      params.overtimeHours,
      params.status,
    ],
  );

  return (result.rowCount ?? 0) > 0;
}

async function seedAttendance(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employees = await fetchEmployeePool(client, EMPLOYEE_POOL_SIZE);

    if (employees.length === 0) {
      throw new Error("no registered users found to attach attendance to");
    }

    let seeded = 0;
    for (const employee of employees) {
      const daysAgoList = distinctDaysAgo(DATES_PER_EMPLOYEE, WINDOW_DAYS);

      for (const daysAgo of daysAgoList) {
        const outcome = attendanceOutcome(daysAgo);
        const attendanceDate = formatLocalDate(dayAt(daysAgo, 0, 0));

        const inserted = await insertAttendance(client, {
          employeeId: employee.id,
          attendanceDate,
          checkIn: outcome.checkIn,
          checkOut: outcome.checkOut,
          overtimeHours: outcome.overtimeHours,
          status: outcome.status,
        });

        if (inserted) seeded++;
      }
    }

    await client.query("COMMIT");
    logger.info(`seeded ${seeded} attendance records for ${employees.length} employees`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seedAttendance()
  .catch((error) => {
    logger.error({ err: error }, "seed-attendance failed");
    process.exit(1);
  })
  .finally(() => pool.end());
