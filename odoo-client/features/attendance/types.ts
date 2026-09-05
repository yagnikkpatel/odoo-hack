export const ATTENDANCE_TIMEZONE = 'Asia/Kolkata'
export const ATTENDANCE_STATUSES = {
  present: 'Present',
  absent: 'Absent',
  incomplete: 'Incomplete',
} as const
export type AttendanceStatus = keyof typeof ATTENDANCE_STATUSES
export type AttendanceScope = 'own' | 'all'
export type SaveResult = { ok: true; id: string } | { ok: false; error: string }
export type Attendance = {
  id: string
  employeeId: string
  employeeName: string
  employeeEmail: string
  attendanceDate: string
  checkIn: string | null
  checkOut: string | null
  workedHours: number
  overtimeHours: number
  status: AttendanceStatus
  editedBy: string | null
  editedByName: string | null
  editedAt: string | null
  editReason: string | null
  createdAt: string
  updatedAt: string
}
export type AttendanceRow = Attendance
export type AttendanceInput = {
  employeeId: string
  attendanceDate: string
  checkIn?: string
  checkOut?: string
  overtimeHours?: number
  status?: AttendanceStatus
  editReason?: string
}
export type AttendanceUpdateInput = {
  checkIn?: string | null
  checkOut?: string | null
  overtimeHours?: number
  status?: AttendanceStatus
  editReason?: string
}
export type AttendanceListQuery = {
  scope?: AttendanceScope
  limit: number
  offset: number
  status?: AttendanceStatus
  employeeId?: string
  search?: string
  from?: string
  to?: string
}
export type AttendancePagination = {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}
export type AttendanceListResult = {
  attendances: Attendance[]
  pagination: AttendancePagination
}

export function companyDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: string) => parts.find(part => part.type === type)?.value
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`
}
export const localDateTime = companyDateTime

export function validDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false
  const date = new Date(`${value}:00+05:30`)
  return Number.isFinite(date.getTime()) && companyDateTime(date) === value
}
export function toAttendanceTimestamp(value: string) {
  if (!validDateTime(value)) throw new Error('Enter a valid date and time.')
  return new Date(`${value}:00+05:30`).toISOString()
}

export function workedMinutes(record: Pick<Attendance, 'workedHours'>) {
  return Math.round(record.workedHours * 60)
}

export function hoursLabel(minutes?: number) {
  if (minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return '—'
  const rounded = Math.round(minutes)
  return `${Math.floor(rounded / 60)}h ${rounded % 60}m`
}

export function dateTimeLabel(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ATTENDANCE_TIMEZONE,
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}
