import { pool } from "../lib/db";
import {
  ATTENDANCE_TIMEZONE,
  AttendanceRecord,
  AttendanceVerification,
  OPEN_SESSION_MAX_HOURS,
} from "../types/attendance";

const ATTENDANCE_COLUMNS = `
    a.id AS "id",
    a.employee_id AS "employeeId",
    u.name AS "employeeName",
    u.email AS "employeeEmail",
    to_char(a.attendance_date, 'YYYY-MM-DD') AS "attendanceDate",
    a.check_in AS "checkIn",
    a.check_out AS "checkOut",
    a.worked_hours::float8 AS "workedHours",
    a.overtime_hours::float8 AS "overtimeHours",
    a.status AS "status",
    a.check_in_verification AS "checkInVerification",
    a.check_out_verification AS "checkOutVerification",
    a.edited_by AS "editedBy",
    e.name AS "editedByName",
    a.edited_at AS "editedAt",
    a.edit_reason AS "editReason",
    a.created_at AS "createdAt",
    a.updated_at AS "updatedAt"
`;

const ATTENDANCE_JOINS = `
  JOIN users u ON u.id = a.employee_id
  LEFT JOIN users e ON e.id = a.edited_by
`;

const ATTENDANCE_FROM = `
  FROM attendances a
  ${ATTENDANCE_JOINS}
`;

/** Today's date in company local time, as Postgres sees it. */
const LOCAL_TODAY = `(NOW() AT TIME ZONE $1::text)::date`;

const UPDATABLE_COLUMNS: Record<string, string> = {
  checkIn: "check_in",
  checkOut: "check_out",
  status: "status",
  overtimeHours: "overtime_hours",
  editReason: "edit_reason",
};

export type AttendanceFields = {
  checkIn?: string | null;
  checkOut?: string | null;
  status?: string;
  overtimeHours?: number;
  editReason?: string;
};

export async function checkInEmployee(
  employeeId: string,
  verification: AttendanceVerification | null = null,
): Promise<AttendanceRecord | null> {
  const result = await pool.query<AttendanceRecord>(
    `WITH inserted AS (
       INSERT INTO attendances (employee_id, attendance_date, check_in, status, check_in_verification)
       VALUES ($2, ${LOCAL_TODAY}, NOW(), 'incomplete', $3::jsonb)
       ON CONFLICT (employee_id, attendance_date) DO NOTHING
       RETURNING *
     )
     SELECT ${ATTENDANCE_COLUMNS}
     FROM inserted a
     ${ATTENDANCE_JOINS}`,
    [ATTENDANCE_TIMEZONE, employeeId, verification],
  );

  return result.rows[0] ?? null;
}

export async function checkOutEmployee(
  employeeId: string,
  verification: AttendanceVerification | null = null,
): Promise<AttendanceRecord | null> {
  const result = await pool.query<AttendanceRecord>(
    `WITH updated AS (
       UPDATE attendances
       SET check_out = NOW(),
           check_out_verification = $3::jsonb,
           status = CASE WHEN status = 'incomplete' THEN 'present' ELSE status END,
           updated_at = NOW()
       WHERE id = (
         SELECT id
         FROM attendances
         WHERE employee_id = $1
           AND check_in IS NOT NULL
           AND check_out IS NULL
           AND check_in > NOW() - ($2 || ' hours')::interval
         ORDER BY check_in DESC
         LIMIT 1
       )
       AND check_out IS NULL
       RETURNING *
     )
     SELECT ${ATTENDANCE_COLUMNS}
     FROM updated a
     ${ATTENDANCE_JOINS}`,
    [employeeId, String(OPEN_SESSION_MAX_HOURS), verification],
  );

  return result.rows[0] ?? null;
}

/**
 * The employee's currently open session, if any. Deliberately not scoped to
 * today so an overnight shift can still be closed the following morning.
 */
export async function findOpenAttendance(
  employeeId: string,
): Promise<AttendanceRecord | null> {
  const result = await pool.query<AttendanceRecord>(
    `SELECT ${ATTENDANCE_COLUMNS}
     ${ATTENDANCE_FROM}
     WHERE a.employee_id = $1
       AND a.check_in IS NOT NULL
       AND a.check_out IS NULL
       AND a.check_in > NOW() - ($2 || ' hours')::interval
     ORDER BY a.check_in DESC
     LIMIT 1`,
    [employeeId, String(OPEN_SESSION_MAX_HOURS)],
  );

  return result.rows[0] ?? null;
}

export async function findTodayAttendance(
  employeeId: string,
): Promise<AttendanceRecord | null> {
  const result = await pool.query<AttendanceRecord>(
    `SELECT ${ATTENDANCE_COLUMNS}
     ${ATTENDANCE_FROM}
     WHERE a.employee_id = $2
       AND a.attendance_date = ${LOCAL_TODAY}`,
    [ATTENDANCE_TIMEZONE, employeeId],
  );

  return result.rows[0] ?? null;
}

export async function getLocalToday(): Promise<string> {
  const result = await pool.query<{ today: string }>(
    `SELECT to_char(${LOCAL_TODAY}, 'YYYY-MM-DD') AS "today"`,
    [ATTENDANCE_TIMEZONE],
  );

  return result.rows[0].today;
}

export async function insertAttendance(input: {
  employeeId: string;
  attendanceDate: string;
  checkIn?: string;
  checkOut?: string;
  overtimeHours: number;
  status: string;
}): Promise<AttendanceRecord> {
  const result = await pool.query<AttendanceRecord>(
    `WITH inserted AS (
       INSERT INTO attendances (
         employee_id, attendance_date, check_in, check_out, overtime_hours, status
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *
     )
     SELECT ${ATTENDANCE_COLUMNS}
     FROM inserted a
     ${ATTENDANCE_JOINS}`,
    [
      input.employeeId,
      input.attendanceDate,
      input.checkIn ?? null,
      input.checkOut ?? null,
      input.overtimeHours,
      input.status,
    ],
  );

  return result.rows[0];
}

export async function findAttendanceById(
  id: string,
): Promise<AttendanceRecord | null> {
  const result = await pool.query<AttendanceRecord>(
    `SELECT ${ATTENDANCE_COLUMNS} ${ATTENDANCE_FROM} WHERE a.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findAllAttendances(query: {
  limit: number;
  offset: number;
  status?: string;
  employeeId?: string;
  search?: string;
  from?: string;
  to?: string;
}): Promise<{ rows: AttendanceRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.status) {
    values.push(query.status);
    conditions.push(`a.status = $${values.length}`);
  }

  if (query.employeeId) {
    values.push(query.employeeId);
    conditions.push(`a.employee_id = $${values.length}`);
  }

  if (query.from) {
    values.push(query.from);
    conditions.push(`a.attendance_date >= $${values.length}`);
  }

  if (query.to) {
    values.push(query.to);
    conditions.push(`a.attendance_date <= $${values.length}`);
  }

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(query.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(query.offset);
  const offsetPlaceholder = `$${values.length}`;

  const result = await pool.query<AttendanceRecord & { total: number }>(
    `SELECT COUNT(*) OVER()::int AS "total", ${ATTENDANCE_COLUMNS}
     ${ATTENDANCE_FROM}
     ${where}
     ORDER BY a.attendance_date DESC, u.name ASC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  );

  return {
    rows: result.rows.map(({ total, ...attendance }) => attendance),
    total: result.rows[0]?.total ?? 0,
  };
}

export async function updateAttendanceById(
  id: string,
  fields: AttendanceFields,
  editedBy: string,
): Promise<AttendanceRecord | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = fields[key as keyof AttendanceFields];

    if (value !== undefined) {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    }
  }

  values.push(editedBy);
  assignments.push(`edited_by = $${values.length}`);
  assignments.push("edited_at = NOW()");
  assignments.push("updated_at = NOW()");

  values.push(id);

  const result = await pool.query<AttendanceRecord>(
    `WITH updated AS (
       UPDATE attendances
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING *
     )
     SELECT ${ATTENDANCE_COLUMNS}
     FROM updated a
     ${ATTENDANCE_JOINS}`,
    values,
  );

  return result.rows[0] ?? null;
}

export async function deleteAttendanceById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM attendances WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

/**
 * Nightly backfill: every active employee with no row for that day is absent.
 * Weekends are skipped as a stand-in until Working Schedule (Phase 4) provides
 * real per-employee calendars.
 */
export async function insertAbsentees(
  attendanceDate: string,
): Promise<string[]> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO attendances (employee_id, attendance_date, status)
     SELECT u.id, $1::date, 'absent'
     FROM users u
     JOIN employee_profiles ep ON ep.user_id = u.id
     WHERE u.status = 'active'
       AND EXTRACT(ISODOW FROM $1::date) < 6
     ON CONFLICT (employee_id, attendance_date) DO NOTHING
     RETURNING id`,
    [attendanceDate],
  );

  return result.rows.map((row) => row.id);
}
