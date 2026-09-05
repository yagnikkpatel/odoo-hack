import { listAttendances } from "./service";
import type { AttendanceListQuery } from "./types";

export async function loadAllAttendanceRecords(
  query: AttendanceListQuery,
  signal?: AbortSignal,
) {
  if (query.from && query.to && query.from > query.to) return [];
  // Fetching the first page tells us the total, so every remaining page can
  // be requested in parallel instead of waiting on a serial offset-by-offset
  // loop - the difference between one round trip and several in a row for
  // any export that spans more than 100 records.
  signal?.throwIfAborted();
  const first = await listAttendances({ ...query, limit: 100, offset: 0 }, signal);
  signal?.throwIfAborted();
  const total = first.pagination.total;
  const pageCount = Math.ceil(total / 100);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      listAttendances({ ...query, limit: 100, offset: (index + 1) * 100 }, signal),
    ),
  );
  signal?.throwIfAborted();
  const records = [first, ...rest].flatMap((page) => page.attendances);
  if (records.length < total) {
    throw new Error("Not all attendance records could be loaded. Please retry.");
  }
  return records;
}
