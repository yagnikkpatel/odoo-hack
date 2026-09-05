import {
  endOfMonth,
  endOfWeek,
  format,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { listAttendances } from "./service";
import { companyDateTime } from "./types";
import type { Attendance, AttendanceListQuery } from "./types";

export function calendarDateRange(monthParam: string) {
  const today = new Date(companyDateTime().slice(0, 10) + "T12:00:00");
  const parsed = parse(monthParam, "yyyy-MM", today);
  const month = Number.isNaN(parsed.getTime()) ? today : parsed;
  return {
    from: format(
      startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      "yyyy-MM-dd",
    ),
    to: format(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), "yyyy-MM-dd"),
  };
}

export async function loadAllAttendanceRecords(
  query: AttendanceListQuery,
  signal?: AbortSignal,
) {
  const records: Attendance[] = [];
  if (query.from && query.to && query.from > query.to) return records;
  let offset = 0;
  while (true) {
    signal?.throwIfAborted();
    const page = await listAttendances(
      { ...query, limit: 100, offset },
      signal,
    );
    signal?.throwIfAborted();
    records.push(...page.attendances);
    if (!page.pagination.hasMore) return records;
    if (!page.attendances.length)
      throw new Error(
        "Not all attendance records could be loaded. Please retry.",
      );
    offset += page.attendances.length;
  }
}
