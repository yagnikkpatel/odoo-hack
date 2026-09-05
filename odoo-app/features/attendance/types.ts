export type AttendanceStatus = "present" | "incomplete" | "absent";
export type Position = { latitude: number; longitude: number; accuracyM: number | null };
export type Verification = {
  face: { source: "self" | "hr_photo" | null; status: string };
  location: { status: string; distanceM: number | null; workLocation: string | null };
};
export type Attendance = {
  id: string; employeeId: string; attendanceDate: string;
  checkIn: string | null; checkOut: string | null;
  workedHours: number; overtimeHours: number; status: AttendanceStatus;
  checkInVerification?: Verification | null; checkOutVerification?: Verification | null;
};
export type VerificationStatus = {
  face: { enrolled: boolean; enrolledAt?: string | null; source?: "self" | "hr_photo" | null };
  office: { configured: boolean; name: string | null; radiusM: number | null };
};
export const DAILY_TARGET_HOURS = 8;
export const TIMEZONE_LABEL = "IST · Asia/Kolkata";
export const STATUS_LABELS = { present: "Present", incomplete: "Incomplete", absent: "Absent" };
export const todayDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
export const monthStart = (date: string) => date.slice(0, 7) + "-01";
export const timeLabel = (value: string | null) => value ? new Date(value).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "—";
export const dayLabel = (value: string) => new Date(value + "T12:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
export const monthLabel = (value: string) => new Date(value + "T12:00:00Z").toLocaleDateString("en-IN", { month: "long" });
export const compactHours = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);
export const hoursLabel = (value: number) => { const minutes = Math.round(value * 60); return `${Math.floor(minutes / 60)}h ${minutes % 60}m`; };
export const distanceLabel = (value: number) => value < 1000 ? `${Math.round(value)} m` : `${(value / 1000).toFixed(1)} km`;
