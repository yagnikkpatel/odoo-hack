import { monthStart, monthLabel, DAILY_TARGET_HOURS, type Attendance } from "./types";
export type Series = { values: (number | null)[]; labels: string[]; total: number; period: string; description: string };
const sum = (records: Attendance[]) => records.reduce((total, r) => total + r.workedHours, 0);
export function monthOverview(records: Attendance[], date: string) {
  const month = records.filter(r => r.attendanceDate >= monthStart(date) && r.attendanceDate <= date);
  const counts = { present: 0, incomplete: 0, absent: 0 };
  for (const r of month) counts[r.status]++;
  let workdaysSoFar = 0;
  const current = new Date(monthStart(date) + "T12:00:00Z");
  while (current.toISOString().slice(0, 10) <= date) {
    if (![0, 6].includes(current.getUTCDay())) workdaysSoFar++;
    current.setUTCDate(current.getUTCDate() + 1);
  }
  const presentDays = month.filter(r => r.checkIn).length;
  const weekdayPresent = month.filter(r => r.checkIn && ![0, 6].includes(new Date(r.attendanceDate + "T12:00:00Z").getUTCDay())).length;
  const completed = month.filter(r => r.checkOut);
  return { presentDays, counts, workdaysSoFar, attendanceRate: workdaysSoFar ? weekdayPresent / workdaysSoFar : null, averageHours: completed.length ? sum(completed) / completed.length : null, totalHours: sum(month), targetHours: workdaysSoFar * DAILY_TARGET_HOURS };
}
export function weekSeries(records: Attendance[], date: string): Series {
  const start = new Date(date + "T12:00:00Z");
  start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const values = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(start); day.setUTCDate(day.getUTCDate() + i);
    const record = records.find(r => r.attendanceDate === day.toISOString().slice(0, 10));
    return record?.checkOut ? record.workedHours : null;
  });
  return { values, labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], total: values.reduce<number>((a, b) => a + (b ?? 0), 0), period: "This week", description: "Completed hours this week" };
}
export function monthSeries(records: Attendance[], date: string): Series {
  const month = records.filter(r => r.attendanceDate.slice(0, 7) === date.slice(0, 7) && r.attendanceDate <= date && r.checkOut);
  const days = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate();
  const values = Array.from({ length: Math.ceil(days / 7) }, (_, week) => {
    const rows = month.filter(r => Math.floor((Number(r.attendanceDate.slice(8)) - 1) / 7) === week);
    return rows.length ? sum(rows) / rows.length : null;
  });
  return { values, labels: values.map((_, i) => `Week ${i + 1}`), total: sum(month), period: monthLabel(date), description: "Total completed hours · weekly averages" };
}
