import { pool, Queryable } from "../lib/db";
import { PageParams } from "../types/common";
import { ScheduleLineInput, WorkingScheduleLineRow, WorkingScheduleRow } from "../types/schedule";

const SCHEDULE_SELECT = `
  SELECT ws.id, ws.name, ws.schedule_type, ws.timezone,
         ws.hours_per_week::text AS hours_per_week,
         ws.is_flexible, ws.active, ws.created_at, ws.updated_at,
         (SELECT COUNT(*)::text FROM employees e
           WHERE e.working_schedule_id = ws.id AND e.employment_status <> 'terminated')
           AS employee_count
    FROM working_schedules ws
`;

export async function list(
  params: PageParams,
  filters: { scheduleType?: string; active?: boolean },
  db: Queryable = pool,
): Promise<{ rows: WorkingScheduleRow[]; total: number }> {
  const where: string[] = [];
  const values: unknown[] = [];

  if (params.q) {
    values.push(`%${params.q}%`);
    where.push(`ws.name ILIKE $${values.length}`);
  }

  if (filters.scheduleType) {
    values.push(filters.scheduleType);
    where.push(`ws.schedule_type = $${values.length}`);
  }

  if (filters.active !== undefined) {
    values.push(filters.active);
    where.push(`ws.active = $${values.length}`);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM working_schedules ws ${clause}`,
    values,
  );

  const rows = await db.query<WorkingScheduleRow>(
    `${SCHEDULE_SELECT} ${clause}
      ORDER BY ws.${params.sort} ${params.order.toUpperCase()}, ws.id
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, params.limit, params.offset],
  );

  return { rows: rows.rows, total: Number(total.rows[0].count) };
}

export async function findById(
  id: string,
  db: Queryable = pool,
): Promise<WorkingScheduleRow | null> {
  const result = await db.query<WorkingScheduleRow>(`${SCHEDULE_SELECT} WHERE ws.id = $1`, [id]);

  return result.rows[0] ?? null;
}

export async function findLines(
  scheduleId: string,
  db: Queryable = pool,
): Promise<WorkingScheduleLineRow[]> {
  const result = await db.query<WorkingScheduleLineRow>(
    `SELECT id, working_schedule_id, day_of_week, day_period,
            to_char(start_time, 'HH24:MI') AS start_time,
            to_char(end_time,   'HH24:MI') AS end_time,
            break_minutes
       FROM working_schedule_lines
      WHERE working_schedule_id = $1
      ORDER BY day_of_week, start_time`,
    [scheduleId],
  );

  return result.rows;
}

export async function insert(
  data: {
    name: string;
    scheduleType?: string;
    timezone?: string;
    isFlexible?: boolean;
    active?: boolean;
    hoursPerWeek: string;
  },
  db: Queryable,
): Promise<string> {
  const result = await db.query<{ id: string }>(
    `INSERT INTO working_schedules (name, schedule_type, timezone, is_flexible, active, hours_per_week)
     VALUES ($1, COALESCE($2, 'full_time'), COALESCE($3, 'Asia/Kolkata'),
             COALESCE($4, FALSE), COALESCE($5, TRUE), $6)
     RETURNING id`,
    [
      data.name,
      data.scheduleType ?? null,
      data.timezone ?? null,
      data.isFlexible ?? null,
      data.active ?? null,
      data.hoursPerWeek,
    ],
  );

  return result.rows[0].id;
}

export async function updateHeader(
  id: string,
  data: {
    name?: string;
    scheduleType?: string;
    timezone?: string;
    isFlexible?: boolean;
    active?: boolean;
    hoursPerWeek?: string;
  },
  db: Queryable,
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];

  for (const [column, value] of [
    ["name", data.name],
    ["schedule_type", data.scheduleType],
    ["timezone", data.timezone],
    ["is_flexible", data.isFlexible],
    ["active", data.active],
    ["hours_per_week", data.hoursPerWeek],
  ] as [string, unknown][]) {
    if (value !== undefined) {
      values.push(value);
      sets.push(`${column} = $${values.length}`);
    }
  }

  if (sets.length === 0) {
    return;
  }

  values.push(id);

  await db.query(
    `UPDATE working_schedules SET ${sets.join(", ")}, updated_at = NOW()
      WHERE id = $${values.length}`,
    values,
  );
}

/** BR-SCH-4: the whole weekly pattern is swapped, or nothing is. Caller owns the transaction. */
export async function replaceLines(
  scheduleId: string,
  lines: ScheduleLineInput[],
  db: Queryable,
): Promise<void> {
  await db.query("DELETE FROM working_schedule_lines WHERE working_schedule_id = $1", [
    scheduleId,
  ]);

  for (const line of lines) {
    await db.query(
      `INSERT INTO working_schedule_lines
         (working_schedule_id, day_of_week, day_period, start_time, end_time, break_minutes)
       VALUES ($1, $2, COALESCE($3, 'full_day'), $4, $5, COALESCE($6, 0))`,
      [
        scheduleId,
        line.day_of_week,
        line.day_period ?? null,
        line.start_time,
        line.end_time,
        line.break_minutes ?? null,
      ],
    );
  }
}

export async function countRunningContracts(
  scheduleId: string,
  db: Queryable = pool,
): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM contracts
      WHERE working_schedule_id = $1 AND status = 'running'`,
    [scheduleId],
  );

  return Number(result.rows[0].count);
}
