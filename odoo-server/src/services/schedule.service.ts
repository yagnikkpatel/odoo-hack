import { z } from "zod";
import { AppError } from "../errors/AppError";
import { withTransaction } from "../lib/db";
import { buildPageMeta, parsePageParams } from "../lib/pagination";
import { findOverlap, lineMinutes, weeklyHours } from "../lib/schedule-hours";
import { parseOrThrow, rejectReadOnlyFields } from "../lib/validate";
import * as scheduleRepository from "../repositories/schedule.repository";
import { ScheduleLineInput, WorkingScheduleLineRow, WorkingScheduleRow } from "../types/schedule";

const SORTABLE = ["name", "hours_per_week", "schedule_type", "created_at"];

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const lineSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  day_period: z.enum(["morning", "afternoon", "full_day"]).optional(),
  start_time: z.string().regex(TIME, "must be HH:MM"),
  end_time: z.string().regex(TIME, "must be HH:MM"),
  break_minutes: z.number().int().min(0).optional(),
});

const scheduleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  schedule_type: z.enum(["full_time", "part_time", "flexible"]).optional(),
  timezone: z.string().trim().min(1).optional(),
  is_flexible: z.boolean().optional(),
  active: z.boolean().optional(),
  lines: z.array(lineSchema).max(21).optional(),
});

export async function list(query: Record<string, unknown>) {
  const params = parsePageParams(query, { sortable: SORTABLE, defaultSort: "name" });

  const { rows, total } = await scheduleRepository.list(params, {
    scheduleType: typeof query.schedule_type === "string" ? query.schedule_type : undefined,
    active:
      query.active === undefined || query.active === ""
        ? undefined
        : query.active === "true" || query.active === true,
  });

  return {
    rows: rows.map((row) => present(row, [])),
    meta: buildPageMeta(params, total),
  };
}

export async function getById(id: string) {
  const schedule = await load(id);

  return present(schedule, await scheduleRepository.findLines(id));
}

export async function create(input: unknown) {
  assertNotDerived(input);

  const data = parseOrThrow(scheduleSchema, input);
  const lines = data.lines ?? [];

  validateLines(lines);

  const id = await withTransaction(async (client) => {
    const created = await scheduleRepository.insert(
      {
        name: data.name,
        scheduleType: data.schedule_type,
        timezone: data.timezone,
        isFlexible: data.is_flexible,
        active: data.active,
        hoursPerWeek: weeklyHours(lines),
      },
      client,
    );

    await scheduleRepository.replaceLines(created, lines, client);

    return created;
  });

  return getById(id);
}

export async function update(id: string, input: unknown) {
  assertNotDerived(input);

  const data = parseOrThrow(scheduleSchema.partial(), input);

  await load(id);

  if (data.lines) {
    validateLines(data.lines);
  }

  await withTransaction(async (client) => {
    await scheduleRepository.updateHeader(
      id,
      {
        name: data.name,
        scheduleType: data.schedule_type,
        timezone: data.timezone,
        isFlexible: data.is_flexible,
        active: data.active,
        // Only recomputed when the pattern itself is replaced.
        hoursPerWeek: data.lines ? weeklyHours(data.lines) : undefined,
      },
      client,
    );

    if (data.lines) {
      await scheduleRepository.replaceLines(id, data.lines, client);
    }
  });

  return getById(id);
}

/** BR-SCH-5: a schedule in use by a running contract cannot be archived. */
export async function archive(id: string): Promise<void> {
  await load(id);

  const inUse = await scheduleRepository.countRunningContracts(id);

  if (inUse > 0) {
    throw new AppError(
      409,
      `${inUse} running contract(s) still use this schedule — reassign them first.`,
      "in_use",
    );
  }

  await withTransaction((client) =>
    scheduleRepository.updateHeader(id, { active: false }, client),
  );
}

// ── helpers ────────────────────────────────────────────────────────────────

async function load(id: string): Promise<WorkingScheduleRow> {
  const schedule = await scheduleRepository.findById(id);

  if (!schedule) {
    throw new AppError(404, "Working schedule not found.", "not_found");
  }

  return schedule;
}

/** BR-SCH-1: `hours_per_week` is derived; sending it is a client bug, not a preference. */
function assertNotDerived(input: unknown): void {
  if (input && typeof input === "object") {
    rejectReadOnlyFields(input as Record<string, unknown>, ["hours_per_week"]);
  }
}

function validateLines(lines: ScheduleLineInput[]): void {
  lines.forEach((line, index) => {
    // BR-SCH-2
    if (lineMinutes(line) <= 0) {
      throw new AppError(
        400,
        `Line ${index + 1}: the break must be shorter than the work span.`,
        "validation_error",
        [{ field: `lines.${index}.break_minutes`, message: "leaves no working time" }],
      );
    }
  });

  // BR-SCH-3
  const overlap = findOverlap(lines);

  if (overlap) {
    throw new AppError(
      400,
      `Lines ${overlap.a + 1} and ${overlap.b + 1} overlap on the same day.`,
      "schedule_line_overlap",
      [{ field: `lines.${overlap.b}.start_time`, message: "overlaps an earlier line" }],
    );
  }
}

function present(row: WorkingScheduleRow, lines: WorkingScheduleLineRow[]) {
  return {
    id: row.id,
    name: row.name,
    schedule_type: row.schedule_type,
    timezone: row.timezone,
    hours_per_week: row.hours_per_week,
    is_flexible: row.is_flexible,
    active: row.active,
    employee_count: Number(row.employee_count),
    lines: lines.map((line) => ({
      id: line.id,
      day_of_week: line.day_of_week,
      day_period: line.day_period,
      start_time: line.start_time,
      end_time: line.end_time,
      break_minutes: line.break_minutes,
      hours: (lineMinutes(line) / 60).toFixed(2),
    })),
  };
}
