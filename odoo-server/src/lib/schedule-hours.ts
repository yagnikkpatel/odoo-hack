import { ScheduleLineInput } from "../types/schedule";

/**
 * Minutes between two `HH:MM` (or `HH:MM:SS`) times on the same day.
 * Times are wall-clock in the schedule's own timezone, so no date maths is involved.
 */
export function minutesBetween(start: string, end: string): number {
  return toMinutes(end) - toMinutes(start);
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + (minutes ?? 0);
}

export function lineMinutes(line: ScheduleLineInput): number {
  return minutesBetween(line.start_time, line.end_time) - (line.break_minutes ?? 0);
}

/** BR-SCH-1: weekly hours are derived from the lines, never entered by hand. */
export function weeklyHours(lines: ScheduleLineInput[]): string {
  const minutes = lines.reduce((total, line) => total + lineMinutes(line), 0);

  return (minutes / 60).toFixed(2);
}

/** BR-SCH-3: two lines on the same weekday may not overlap. */
export function findOverlap(
  lines: ScheduleLineInput[],
): { a: number; b: number } | null {
  const byDay = new Map<number, { index: number; from: number; to: number }[]>();

  lines.forEach((line, index) => {
    const day = byDay.get(line.day_of_week) ?? [];

    day.push({ index, from: toMinutes(line.start_time), to: toMinutes(line.end_time) });
    byDay.set(line.day_of_week, day);
  });

  for (const spans of byDay.values()) {
    spans.sort((x, y) => x.from - y.from);

    for (let i = 1; i < spans.length; i += 1) {
      if (spans[i].from < spans[i - 1].to) {
        return { a: spans[i - 1].index, b: spans[i].index };
      }
    }
  }

  return null;
}

/** Scheduled minutes for one weekday (0 = Monday), used by attendance and payroll. */
export function minutesForDay(lines: ScheduleLineInput[], dayOfWeek: number): number {
  return lines
    .filter((line) => line.day_of_week === dayOfWeek)
    .reduce((total, line) => total + lineMinutes(line), 0);
}
