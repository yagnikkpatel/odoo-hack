import { ApiError } from '@/lib/api-client'
import type { Attendance, AttendancePagination, AttendanceStatus } from './types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function invalid(field = 'response'): never {
  throw new ApiError(`The attendance service returned an invalid ${field}.`, 502)
}
export function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  return value as Record<string, unknown>
}
export function requireAttendanceId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new ApiError('A valid attendance ID is required.', 400)
  return value
}
function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(field)
  return value
}
function nullableText(value: unknown, field: string) {
  return value === null ? null : text(value, field)
}
function timestamp(value: unknown): string {
  const result = text(value, 'timestamp')
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(result) || !Number.isFinite(Date.parse(result))) invalid('timestamp')
  return result
}
function hours(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) invalid('hours')
  return value
}
export function mapAttendance(value: unknown): Attendance {
  const record = requireRecord(value)
  if (!['present', 'absent', 'incomplete'].includes(String(record.status))) invalid('status')
  const attendanceDate = text(record.attendanceDate, 'date')
  const date = new Date(`${attendanceDate}T00:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== attendanceDate) invalid('date')
  return {
    id: requireAttendanceId(record.id), employeeId: requireAttendanceId(record.employeeId),
    employeeName: text(record.employeeName, 'employee name'), employeeEmail: text(record.employeeEmail, 'employee email'),
    attendanceDate,
    checkIn: record.checkIn === null ? null : timestamp(record.checkIn),
    checkOut: record.checkOut === null ? null : timestamp(record.checkOut),
    workedHours: hours(record.workedHours), overtimeHours: hours(record.overtimeHours),
    status: record.status as AttendanceStatus,
    editedBy: record.editedBy === null ? null : requireAttendanceId(record.editedBy),
    editedByName: nullableText(record.editedByName, 'editor name'),
    editedAt: record.editedAt === null ? null : timestamp(record.editedAt),
    editReason: nullableText(record.editReason, 'edit reason'),
    createdAt: timestamp(record.createdAt), updatedAt: timestamp(record.updatedAt),
  }
}
export function mapPagination(value: unknown): AttendancePagination {
  const record = requireRecord(value)
  const count = (number: unknown): number => {
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 0) invalid('pagination')
    return number
  }
  const limit = count(record.limit)
  if (limit < 1 || limit > 100 || typeof record.hasMore !== 'boolean') invalid('pagination')
  return { total: count(record.total), limit, offset: count(record.offset), hasMore: record.hasMore }
}
