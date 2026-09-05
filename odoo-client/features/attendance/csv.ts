import { downloadCsv } from "@/features/nexacrm/utils/csv";
import { ATTENDANCE_STATUSES } from "./types";
import type { Attendance } from "./types";

function safeCell(value: string | null) {
  if (!value) return "";
  return /^\s*[=+\-@]/.test(value) ? "'" + value : value;
}

export function attendanceCsvRows(records: Attendance[]) {
  return records.map((record) => ({
    "Record ID": record.id,
    Employee: safeCell(record.employeeName),
    Email: safeCell(record.employeeEmail),
    "Employee ID": record.employeeId,
    "Attendance date (IST)": record.attendanceDate,
    "Check in (ISO timestamp)": record.checkIn || "",
    "Check out (ISO timestamp)": record.checkOut || "",
    "Worked hours": record.workedHours,
    "Overtime hours": record.overtimeHours,
    Status: ATTENDANCE_STATUSES[record.status],
    "Edited by": safeCell(record.editedByName),
    "Edited at": record.editedAt || "",
    "Edit reason": safeCell(record.editReason),
  }));
}

export function downloadAttendanceCsv(
  records: Attendance[],
  filename = "attendance.csv",
) {
  downloadCsv(filename, attendanceCsvRows(records));
}
