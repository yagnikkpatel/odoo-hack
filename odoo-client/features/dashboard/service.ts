import { ApiError } from '@/lib/api-client'
import type { DashboardData, DashboardQuery, DashboardStatusCounts } from './types'

function invalid(): never {
  throw new ApiError('The dashboard returned incomplete data. Please refresh to try again.', 502)
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) invalid()
  return value
}
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid()
  return value
}
function count(value: unknown): number {
  const result = number(value)
  if (!Number.isSafeInteger(result) || result < 0) invalid()
  return result
}
function nullableNumber(value: unknown): number | null {
  return value === null ? null : number(value)
}
function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') invalid()
  return value
}
function currency(value: unknown): string {
  const result = text(value)
  if (!/^[A-Z]{3}$/.test(result)) invalid()
  return result
}
function list<T>(value: unknown, map: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) invalid()
  return value.map(map)
}
function date(value: unknown): string {
  const result = text(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) invalid()
  const parsed = new Date(`${result}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) invalid()
  return result
}
function statuses(value: unknown): DashboardStatusCounts {
  const data = record(value)
  return { draft: count(data.draft), computed: count(data.computed), validated: count(data.validated), paid: count(data.paid) }
}

/** Reject malformed responses rather than presenting invented zeroes. */
export function mapDashboard(value: unknown): DashboardData {
  const data = record(value)
  const period = record(data.period)
  const filters = record(data.filters)
  const totals = record(data.totals)
  const previous = record(data.previous)
  const attendance = record(data.attendance)
  const leave = record(data.timeOff)
  return {
    period: { startDate: date(period.startDate), endDate: date(period.endDate), previousStartDate: date(period.previousStartDate), previousEndDate: date(period.previousEndDate) },
    currency: currency(data.currency),
    filters: { departments: list(filters.departments, text), jobPositions: list(filters.jobPositions, text), currencies: list(filters.currencies, currency) },
    totals: { payslips: count(totals.payslips), netPaid: number(totals.netPaid), grossPaid: number(totals.grossPaid), deductionsPaid: number(totals.deductionsPaid), employeesPaid: count(totals.employeesPaid), statusCounts: statuses(totals.statusCounts) },
    previous: { netPaid: number(previous.netPaid), payslips: count(previous.payslips) },
    netPaidChange: nullableNumber(data.netPaidChange),
    averageNet: number(data.averageNet),
    headcount: count(data.headcount),
    departments: list(data.departments, item => {
      const row = record(item)
      return { department: text(row.department), headcount: count(row.headcount), payslips: count(row.payslips), net: number(row.net), gross: number(row.gross) }
    }),
    trends: list(data.trends, item => {
      const row = record(item)
      const month = text(row.month)
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) invalid()
      return { month, net: number(row.net), payslips: count(row.payslips) }
    }),
    attendance: {
      records: count(attendance.records), employees: count(attendance.employees), present: count(attendance.present), absent: count(attendance.absent), incomplete: count(attendance.incomplete),
      missingCheckOuts: count(attendance.missingCheckOuts), manualEdits: count(attendance.manualEdits), workedHours: number(attendance.workedHours), overtimeHours: number(attendance.overtimeHours), coverage: nullableNumber(attendance.coverage),
    },
    timeOff: {
      approvedDays: number(leave.approvedDays), approvedHours: number(leave.approvedHours), unpaidDays: number(leave.unpaidDays), unpaidHours: number(leave.unpaidHours), pendingRequests: count(leave.pendingRequests), remainingDays: number(leave.remainingDays), remainingHours: number(leave.remainingHours),
      types: list(leave.types, item => {
        const row = record(item)
        if (row.unit !== 'days' && row.unit !== 'hours') invalid()
        return { typeId: text(row.typeId), name: text(row.name), unit: row.unit, paid: bool(row.paid), approved: number(row.approved), pendingRequests: count(row.pendingRequests), remaining: nullableNumber(row.remaining) }
      }),
    },
    payrunStatusCounts: statuses(data.payrunStatusCounts),
    alerts: list(data.alerts, item => {
      const row = record(item)
      return { code: text(row.code), message: text(row.message), count: count(row.count), blocking: bool(row.blocking) }
    }),
    warnings: list(data.warnings, item => {
      const row = record(item)
      return { code: text(row.code), message: text(row.message), blocking: bool(row.blocking), payrunId: text(row.payrunId), payrunName: text(row.payrunName), ...(row.employeeId ? { employeeId: text(row.employeeId) } : {}) }
    }),
  }
}

export async function getDashboard(query: DashboardQuery, signal?: AbortSignal): Promise<DashboardData> {
  const params = new URLSearchParams({ startDate: query.startDate, endDate: query.endDate, currency: query.currency })
  if (query.department?.trim()) params.set('department', query.department.trim())
  if (query.jobPosition?.trim()) params.set('jobPosition', query.jobPosition.trim())
  const response = await fetch(`/api/payroll/dashboard?${params}`, {
    credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal,
  })
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    if (response.status === 401) throw new ApiError('Your session has expired. Sign in again to view your dashboard.', 401)
    if (response.status === 403) throw new ApiError('Your account does not have access to company payroll insights.', 403)
    throw new ApiError('Dashboard data could not be loaded. Please try again.', response.status)
  }
  const body = record(payload)
  if (body.success !== true) invalid()
  return mapDashboard(body.data)
}
