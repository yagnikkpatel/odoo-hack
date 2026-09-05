export const ATTENDANCE_STATUSES = ["present", "absent", "incomplete"] as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_TIMEZONE = "Asia/Kolkata";

export const OPEN_SESSION_MAX_HOURS = 24;

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  attendanceDate: string;
  checkIn: Date | null;
  checkOut: Date | null;
  workedHours: number;
  overtimeHours: number;
  status: AttendanceStatus;
  editedBy: string | null;
  editedByName: string | null;
  editedAt: Date | null;
  editReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AttendanceListResult = {
  attendances: AttendanceRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};
