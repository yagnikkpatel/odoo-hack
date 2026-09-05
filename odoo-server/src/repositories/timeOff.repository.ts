import { pool } from "../lib/db";
import {
  TIME_OFF_TYPE_LABELS,
  TimeOffRequestRecord,
  TimeOffType,
} from "../types/timeOff";

type TimeOffRow = Omit<TimeOffRequestRecord, "timeOffTypeLabel">;

const TIME_OFF_COLUMNS = `
    t.id AS "id",
    t.employee_id AS "employeeId",
    u.name AS "employeeName",
    u.email AS "employeeEmail",
    t.time_off_type AS "timeOffType",
    to_char(t.start_date, 'YYYY-MM-DD') AS "startDate",
    to_char(t.end_date, 'YYYY-MM-DD') AS "endDate",
    t.duration_days AS "durationDays",
    t.reason AS "reason",
    t.status AS "status",
    t.approver_id AS "approverId",
    a.name AS "approverName",
    t.decided_at AS "decidedAt",
    t.decision_note AS "decisionNote",
    t.created_at AS "createdAt",
    t.updated_at AS "updatedAt"
`;

const TIME_OFF_JOINS = `
  JOIN users u ON u.id = t.employee_id
  LEFT JOIN users a ON a.id = t.approver_id
`;

const TIME_OFF_FROM = `
  FROM time_off_requests t
  ${TIME_OFF_JOINS}
`;

const UPDATABLE_COLUMNS: Record<string, string> = {
  timeOffType: "time_off_type",
  startDate: "start_date",
  endDate: "end_date",
  reason: "reason",
};

export type TimeOffFields = {
  timeOffType?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
};

/** The display label lives in TypeScript, so it is attached on the way out. */
function withLabel(row: TimeOffRow): TimeOffRequestRecord {
  return {
    ...row,
    timeOffTypeLabel: TIME_OFF_TYPE_LABELS[row.timeOffType as TimeOffType],
  };
}

export async function insertTimeOffRequest(input: {
  employeeId: string;
  timeOffType: string;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<TimeOffRequestRecord> {
  const result = await pool.query<TimeOffRow>(
    `WITH inserted AS (
       INSERT INTO time_off_requests (
         employee_id, time_off_type, start_date, end_date, reason
       )
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *
     )
     SELECT ${TIME_OFF_COLUMNS}
     FROM inserted t
     ${TIME_OFF_JOINS}`,
    [
      input.employeeId,
      input.timeOffType,
      input.startDate,
      input.endDate,
      input.reason,
    ],
  );

  return withLabel(result.rows[0]);
}

export async function findTimeOffRequestById(
  id: string,
): Promise<TimeOffRequestRecord | null> {
  const result = await pool.query<TimeOffRow>(
    `SELECT ${TIME_OFF_COLUMNS} ${TIME_OFF_FROM} WHERE t.id = $1`,
    [id],
  );

  return result.rows[0] ? withLabel(result.rows[0]) : null;
}

export async function findAllTimeOffRequests(query: {
  limit: number;
  offset: number;
  status?: string;
  timeOffType?: string;
  employeeId?: string;
  search?: string;
  from?: string;
  to?: string;
}): Promise<{ rows: TimeOffRequestRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.status) {
    values.push(query.status);
    conditions.push(`t.status = $${values.length}`);
  }

  if (query.timeOffType) {
    values.push(query.timeOffType);
    conditions.push(`t.time_off_type = $${values.length}`);
  }

  if (query.employeeId) {
    values.push(query.employeeId);
    conditions.push(`t.employee_id = $${values.length}`);
  }

  // A request matches the window when it overlaps it, not only when it starts
  // inside it, so a leave spanning the boundary is never missed.
  if (query.from) {
    values.push(query.from);
    conditions.push(`t.end_date >= $${values.length}`);
  }

  if (query.to) {
    values.push(query.to);
    conditions.push(`t.start_date <= $${values.length}`);
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

  const result = await pool.query<TimeOffRow & { total: number }>(
    `SELECT COUNT(*) OVER()::int AS "total", ${TIME_OFF_COLUMNS}
     ${TIME_OFF_FROM}
     ${where}
     ORDER BY t.start_date DESC, t.created_at DESC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  );

  return {
    rows: result.rows.map(({ total, ...request }) => withLabel(request)),
    total: result.rows[0]?.total ?? 0,
  };
}

/** Edits only ever apply to a pending request, enforced in the WHERE clause. */
export async function updateTimeOffRequestById(
  id: string,
  fields: TimeOffFields,
): Promise<TimeOffRequestRecord | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = fields[key as keyof TimeOffFields];

    if (value !== undefined) {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    }
  }

  assignments.push("updated_at = NOW()");

  values.push(id);

  const result = await pool.query<TimeOffRow>(
    `WITH updated AS (
       UPDATE time_off_requests
       SET ${assignments.join(", ")}
       WHERE id = $${values.length} AND status = 'pending'
       RETURNING *
     )
     SELECT ${TIME_OFF_COLUMNS}
     FROM updated t
     ${TIME_OFF_JOINS}`,
    values,
  );

  return result.rows[0] ? withLabel(result.rows[0]) : null;
}

/**
 * Approve or reject in one statement. The `status = 'pending'` guard makes the
 * decision atomic, so two managers clicking at once cannot both win.
 */
export async function decideTimeOffRequest(
  id: string,
  status: string,
  approverId: string,
  decisionNote: string | null,
): Promise<TimeOffRequestRecord | null> {
  const result = await pool.query<TimeOffRow>(
    `WITH decided AS (
       UPDATE time_off_requests
       SET status = $1,
           approver_id = $2,
           decided_at = NOW(),
           decision_note = $3,
           updated_at = NOW()
       WHERE id = $4 AND status = 'pending'
       RETURNING *
     )
     SELECT ${TIME_OFF_COLUMNS}
     FROM decided t
     ${TIME_OFF_JOINS}`,
    [status, approverId, decisionNote, id],
  );

  return result.rows[0] ? withLabel(result.rows[0]) : null;
}

export async function deleteTimeOffRequestById(
  id: string,
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM time_off_requests WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}
