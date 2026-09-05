export type AttendanceInput = {
  employeeId: string
  checkIn: string
  checkOut?: string
  breakMinutes: number
  note: string
}
export type AttendanceChange = {
  at: string
  actorId?: string
  reason: string
  before: AttendanceInput
  after: AttendanceInput
}
export type Attendance = AttendanceInput & {
  id: string
  createdAt: string
  createdById?: string
  corrections: AttendanceChange[]
}
export type AttendanceRow = Attendance & {
  employeeName: string
  avatar?: string
  workedMinutes: number | undefined
  status: AttendanceStatus
}
export const ATTENDANCE_STATUSES = {
  complete: 'Complete',
  open: 'Checked in',
  missing: 'Missing check-out',
}
export type AttendanceStatus = keyof typeof ATTENDANCE_STATUSES
export type SaveResult = { ok: true; id: string } | { ok: false; error: string }

// Local wall-clock form values; the data API must convert these to zoned instants.
export function localDateTime(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}
export function validDateTime(value: string) {
  const parsed = new Date(value)
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) &&
    Number.isFinite(parsed.getTime()) &&
    localDateTime(parsed) === value
  )
}
export function workedMinutes(record: AttendanceInput) {
  if (!record.checkOut) return undefined
  return (
    Math.round(
      (new Date(record.checkOut).getTime() -
        new Date(record.checkIn).getTime()) /
        60000,
    ) - record.breakMinutes
  )
}
export function hoursLabel(minutes?: number) {
  if (minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return '—'
  return `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`
}
export function attendanceStatus(
  record: AttendanceInput,
  today = localDateTime().slice(0, 10),
): AttendanceStatus {
  return record.checkOut
    ? 'complete'
    : record.checkIn.slice(0, 10) < today
      ? 'missing'
      : 'open'
}
export function dateTimeLabel(value?: string) {
  return value
    ? new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : 'Not checked out'
}
export function validateAttendance(
  input: AttendanceInput,
  records: readonly Attendance[],
  employeeIds: readonly string[],
  id?: string,
  now = new Date(),
): string | null {
  if (!employeeIds.includes(input.employeeId))
    return 'Choose an existing employee.'
  if (!validDateTime(input.checkIn))
    return 'Enter a valid check-in date and time.'
  if (new Date(input.checkIn) > now) return 'Check-in cannot be in the future.'
  if (
    input.checkOut &&
    (!validDateTime(input.checkOut) || input.checkOut <= input.checkIn)
  )
    return 'Check-out must be after check-in.'
  if (input.checkOut && new Date(input.checkOut) > now)
    return 'Check-out cannot be in the future.'
  if (!Number.isInteger(input.breakMinutes) || input.breakMinutes < 0)
    return 'Break must be a whole number of minutes, zero or more.'
  if (input.checkOut && (workedMinutes(input) ?? 0) <= 0)
    return 'Break must be shorter than the attendance period.'
  const start = new Date(input.checkIn).getTime()
  const end = input.checkOut ? new Date(input.checkOut).getTime() : Infinity
  if (
    records.some(
      (record) =>
        record.id !== id &&
        record.employeeId === input.employeeId &&
        start <
          (record.checkOut ? new Date(record.checkOut).getTime() : Infinity) &&
        new Date(record.checkIn).getTime() < end,
    )
  ) {
    return 'This overlaps another attendance entry. Resolve any open check-in first.'
  }
  return null
}
