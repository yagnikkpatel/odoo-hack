import { ApiError } from '@/lib/api-client'
import {
  COMPUTATION_METHODS,
  DELIVERY_STATUSES,
  PAYRUN_STATUSES,
  RULE_CATEGORIES,
} from './types'
import type {
  DeliveryDispatch,
  DeliverySkip,
  DeliveryStatus,
  PayrollAlert,
  PayrollAttendanceSummary,
  PayrollDashboard,
  PayrollDashboardWarning,
  PayrollDepartmentRow,
  PayrollTimeOffRow,
  PayrollTimeOffSummary,
  PayrollTrendPoint,
  Payrun,
  PayrollContractSnapshot,
  PayrollEmployeeOption,
  PayrollPagination,
  PayrollStatus,
  PayrollWarning,
  Payslip,
  PayslipDelivery,
  PayslipLine,
  SalaryRule,
  SalaryStructure,
} from './types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function invalid(what: string): never {
  throw new ApiError(`The payroll service returned an invalid ${what}.`, 502)
}

export function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    invalid('response')
  }
  return value as Record<string, unknown>
}

export function requirePayrollId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError('A valid payroll record ID is required.', 400)
  }
  return value
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(field)
  return value.trim()
}

/** Optional on the wire: an employee without a work email still gets a payslip. */
function optionalText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function date(value: unknown, field: string): string {
  const result = text(value, field)
  if (!DATE_PATTERN.test(result)) invalid(field)
  return result
}

function optionalTimestamp(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function number(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(field)
  return value
}

function count(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    invalid(field)
  }
  return value
}

function flag(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') invalid(field)
  return value
}

function key<T extends object>(value: unknown, options: T, field: string): keyof T {
  if (typeof value !== 'string' || !Object.hasOwn(options, value)) invalid(field)
  return value as keyof T
}

function ids(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) invalid(field)
  return value.map(requirePayrollId)
}

function warnings(value: unknown): PayrollWarning[] {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    const record = requireRecord(item)
    const warning: PayrollWarning = {
      code: text(record.code, 'warning code'),
      message: text(record.message, 'warning message'),
      blocking: flag(record.blocking, 'warning severity'),
    }
    if (typeof record.employeeId === 'string') {
      warning.employeeId = requirePayrollId(record.employeeId)
    }
    return warning
  })
}

function lines(value: unknown): PayslipLine[] {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    const record = requireRecord(item)
    return {
      ruleId: requirePayrollId(record.ruleId),
      name: text(record.name, 'rule name'),
      code: text(record.code, 'rule code'),
      category: key(record.category, RULE_CATEGORIES, 'rule category'),
      sequence: count(record.sequence, 'rule sequence'),
      amount: number(record.amount, 'line amount'),
    }
  })
}

function wagePeriod(value: unknown): PayrollContractSnapshot['wagePeriod'] {
  if (value !== 'month' && value !== 'year' && value !== 'hour') {
    invalid('wage period')
  }
  return value
}

function contractSnapshot(value: unknown): PayrollContractSnapshot | undefined {
  if (value === null || value === undefined) return undefined
  const record = requireRecord(value)
  return {
    id: requirePayrollId(record.id),
    startDate: date(record.startDate, 'contract start date'),
    endDate: date(record.endDate, 'contract end date'),
    wage: number(record.wage, 'contract wage'),
    currency: text(record.currency, 'currency'),
    wagePeriod: wagePeriod(record.wagePeriod),
    status: text(record.status, 'contract status'),
  }
}

function payrollStatus(value: unknown): PayrollStatus {
  return key(value, PAYRUN_STATUSES, 'status') as PayrollStatus
}

export function mapSalaryRule(value: unknown): SalaryRule {
  const record = requireRecord(value)
  return {
    id: requirePayrollId(record.id),
    name: text(record.name, 'rule name'),
    code: text(record.code, 'rule code'),
    category: key(record.category, RULE_CATEGORIES, 'rule category'),
    sequence: count(record.sequence, 'rule sequence'),
    method: key(record.method, COMPUTATION_METHODS, 'computation method'),
    amount: number(record.amount, 'rule amount'),
    percentage: number(record.percentage, 'rule percentage'),
    base: optionalText(record.base),
    formula: optionalText(record.formula),
    quantity: number(record.quantity, 'rule quantity'),
    active: flag(record.active, 'rule status'),
  }
}

export function mapSalaryStructure(value: unknown): SalaryStructure {
  const record = requireRecord(value)
  return {
    id: requirePayrollId(record.id),
    name: text(record.name, 'structure name'),
    description: optionalText(record.description),
    active: flag(record.active, 'structure status'),
    ruleIds: ids(record.ruleIds, 'structure rules'),
    employeeCount: count(record.employeeCount, 'structure employee count'),
  }
}

export function mapPayrun(value: unknown): Payrun {
  const record = requireRecord(value)
  return {
    id: requirePayrollId(record.id),
    name: text(record.name, 'payrun name'),
    structureId: requirePayrollId(record.structureId),
    structureName: text(record.structureName, 'structure name'),
    startDate: date(record.startDate, 'period start'),
    endDate: date(record.endDate, 'period end'),
    status: payrollStatus(record.status),
    employeeIds: ids(record.employeeIds, 'payrun employees'),
    payslipCount: count(record.payslipCount, 'payslip count'),
    warnings: warnings(record.warnings),
    createdAt: text(record.createdAt, 'created timestamp'),
    computedAt: optionalTimestamp(record.computedAt),
    validatedAt: optionalTimestamp(record.validatedAt),
    paidAt: optionalTimestamp(record.paidAt),
  }
}

export function mapPayslip(value: unknown): Payslip {
  const record = requireRecord(value)
  return {
    id: requirePayrollId(record.id),
    payrunId: requirePayrollId(record.payrunId),
    payrunName: text(record.payrunName, 'payrun name'),
    employeeId: requirePayrollId(record.employeeId),
    employeeName: text(record.employeeName, 'employee name'),
    employeeEmail: optionalText(record.employeeEmail),
    department: optionalText(record.department),
    jobPosition: optionalText(record.jobPosition),
    structureId: requirePayrollId(record.structureId),
    structureName: text(record.structureName, 'structure name'),
    startDate: date(record.startDate, 'period start'),
    endDate: date(record.endDate, 'period end'),
    status: payrollStatus(record.status),
    currency: text(record.currency, 'currency'),
    workedDays: number(record.workedDays, 'worked days'),
    workedHours: number(record.workedHours, 'worked hours'),
    expectedDays: number(record.expectedDays, 'expected days'),
    expectedHours: number(record.expectedHours, 'expected hours'),
    basic: number(record.basic, 'basic total'),
    allowances: number(record.allowances, 'allowance total'),
    deductions: number(record.deductions, 'deduction total'),
    contributions: number(record.contributions, 'contribution total'),
    gross: number(record.gross, 'gross total'),
    net: number(record.net, 'net total'),
    lines: lines(record.lines),
    warnings: warnings(record.warnings),
    contractSnapshot: contractSnapshot(record.contractSnapshot),
    bankAccount: optionalText(record.bankAccount),
  }
}

export function mapEmployeeOption(value: unknown): PayrollEmployeeOption {
  const record = requireRecord(value)
  return {
    id: requirePayrollId(record.id),
    name: text(record.name, 'employee name'),
    email: optionalText(record.email),
    department: optionalText(record.department),
    jobPosition: optionalText(record.jobPosition),
    workingSchedule: optionalText(record.workingSchedule),
    contractId: requirePayrollId(record.contractId),
    startDate: date(record.startDate, 'contract start date'),
    endDate: date(record.endDate, 'contract end date'),
    wage: number(record.wage, 'contract wage'),
    currency: text(record.currency, 'currency'),
    wagePeriod: wagePeriod(record.wagePeriod),
    bankAccount: optionalText(record.bankAccount),
  }
}

export function mapPagination(value: unknown): PayrollPagination {
  const record = requireRecord(value)
  return {
    total: count(record.total, 'pagination total'),
    limit: count(record.limit, 'pagination limit'),
    offset: count(record.offset, 'pagination offset'),
    hasMore: flag(record.hasMore, 'pagination flag'),
  }
}

function deliveryStatus(value: unknown): DeliveryStatus {
  return key(value, DELIVERY_STATUSES, 'delivery status') as DeliveryStatus
}

export function mapDelivery(value: unknown): PayslipDelivery {
  const record = requireRecord(value)
  return {
    id: requirePayrollId(record.id),
    payslipId: requirePayrollId(record.payslipId),
    payrunId: requirePayrollId(record.payrunId),
    employeeId: requirePayrollId(record.employeeId),
    employeeName: text(record.employeeName, 'employee name'),
    recipient: optionalText(record.recipient),
    status: deliveryStatus(record.status),
    attempts: count(record.attempts, 'delivery attempts'),
    error: optionalText(record.error),
    queuedAt: text(record.queuedAt, 'queued timestamp'),
    sentAt: optionalTimestamp(record.sentAt),
  }
}

function mapDeliverySkip(value: unknown): DeliverySkip {
  const record = requireRecord(value)
  return {
    payslipId: requirePayrollId(record.payslipId),
    employeeName: text(record.employeeName, 'employee name'),
    reason: text(record.reason, 'skip reason'),
  }
}

export function mapDeliveryDispatch(value: unknown): DeliveryDispatch {
  const record = requireRecord(value)
  if (!Array.isArray(record.queued) || !Array.isArray(record.skipped)) {
    invalid('delivery result')
  }
  return {
    payrunId: requirePayrollId(record.payrunId),
    queued: record.queued.map(mapDelivery),
    skipped: record.skipped.map(mapDeliverySkip),
  }
}

function optionalNumber(value: unknown, field: string): number | null {
  return value === null ? null : number(value, field)
}

function list(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) invalid(field)
  return value
}

function names(value: unknown, field: string): string[] {
  return list(value, field).map(item => text(item, field))
}

/** A count per payroll status, defaulted so a status the API omitted reads 0. */
function statusCounts(value: unknown, field: string): Record<PayrollStatus, number> {
  const record = requireRecord(value)
  const counts = { draft: 0, computed: 0, validated: 0, paid: 0 }
  for (const status of Object.keys(counts) as PayrollStatus[]) {
    if (record[status] !== undefined) counts[status] = count(record[status], field)
  }
  return counts
}

function departmentRow(value: unknown): PayrollDepartmentRow {
  const record = requireRecord(value)
  return {
    department: text(record.department, 'department'),
    headcount: count(record.headcount, 'department headcount'),
    payslips: count(record.payslips, 'department payslip count'),
    net: number(record.net, 'department net salary'),
    gross: number(record.gross, 'department gross salary'),
  }
}

function trendPoint(value: unknown): PayrollTrendPoint {
  const record = requireRecord(value)
  return {
    month: text(record.month, 'trend month'),
    net: number(record.net, 'trend net salary'),
    payslips: count(record.payslips, 'trend payslip count'),
  }
}

function attendanceSummary(value: unknown): PayrollAttendanceSummary {
  const record = requireRecord(value)
  return {
    records: count(record.records, 'attendance records'),
    employees: count(record.employees, 'attendance employees'),
    present: count(record.present, 'present days'),
    absent: count(record.absent, 'absent days'),
    incomplete: count(record.incomplete, 'incomplete days'),
    missingCheckOuts: count(record.missingCheckOuts, 'missing check-outs'),
    manualEdits: count(record.manualEdits, 'attendance corrections'),
    workedHours: number(record.workedHours, 'worked hours'),
    overtimeHours: number(record.overtimeHours, 'overtime hours'),
    coverage: optionalNumber(record.coverage, 'attendance coverage'),
  }
}

function timeOffRow(value: unknown): PayrollTimeOffRow {
  const record = requireRecord(value)
  if (record.unit !== 'days' && record.unit !== 'hours') invalid('leave unit')
  return {
    typeId: requirePayrollId(record.typeId),
    name: text(record.name, 'leave type name'),
    unit: record.unit,
    paid: flag(record.paid, 'leave payroll treatment'),
    approved: number(record.approved, 'approved leave'),
    pendingRequests: count(record.pendingRequests, 'pending leave requests'),
    remaining: optionalNumber(record.remaining, 'remaining leave'),
  }
}

function timeOffSummary(value: unknown): PayrollTimeOffSummary {
  const record = requireRecord(value)
  return {
    approvedDays: number(record.approvedDays, 'approved leave days'),
    approvedHours: number(record.approvedHours, 'approved leave hours'),
    unpaidDays: number(record.unpaidDays, 'unpaid leave days'),
    unpaidHours: number(record.unpaidHours, 'unpaid leave hours'),
    pendingRequests: count(record.pendingRequests, 'pending leave requests'),
    remainingDays: number(record.remainingDays, 'remaining leave days'),
    remainingHours: number(record.remainingHours, 'remaining leave hours'),
    types: list(record.types, 'leave types').map(timeOffRow),
  }
}

function alerts(value: unknown): PayrollAlert[] {
  return list(value, 'payroll alerts').map(item => {
    const record = requireRecord(item)
    return {
      code: text(record.code, 'alert code'),
      message: text(record.message, 'alert message'),
      count: count(record.count, 'alert count'),
      blocking: flag(record.blocking, 'alert severity'),
    }
  })
}

/** A payrun warning carries the run it came from so the panel can link to it. */
function dashboardWarnings(value: unknown): PayrollDashboardWarning[] {
  return list(value, 'payroll warnings').map(item => {
    const record = requireRecord(item)
    const [warning] = warnings([record])
    return {
      ...warning,
      payrunId: requirePayrollId(record.payrunId),
      payrunName: text(record.payrunName, 'payrun name'),
    }
  })
}

export function mapPayrollDashboard(value: unknown): PayrollDashboard {
  const record = requireRecord(value)
  const period = requireRecord(record.period)
  const filters = requireRecord(record.filters)
  const totals = requireRecord(record.totals)
  const previous = requireRecord(record.previous)
  return {
    period: {
      startDate: date(period.startDate, 'period start'),
      endDate: date(period.endDate, 'period end'),
      previousStartDate: date(period.previousStartDate, 'comparison period start'),
      previousEndDate: date(period.previousEndDate, 'comparison period end'),
    },
    currency: text(record.currency, 'currency'),
    filters: {
      departments: names(filters.departments, 'department list'),
      jobPositions: names(filters.jobPositions, 'job position list'),
      currencies: names(filters.currencies, 'currency list'),
    },
    totals: {
      payslips: count(totals.payslips, 'payslip count'),
      netPaid: number(totals.netPaid, 'net salary paid'),
      grossPaid: number(totals.grossPaid, 'gross salary paid'),
      deductionsPaid: number(totals.deductionsPaid, 'deductions paid'),
      employeesPaid: count(totals.employeesPaid, 'employees paid'),
      statusCounts: statusCounts(totals.statusCounts, 'payslip status counts'),
    },
    previous: {
      netPaid: number(previous.netPaid, 'previous net salary paid'),
      payslips: count(previous.payslips, 'previous payslip count'),
    },
    netPaidChange: optionalNumber(record.netPaidChange, 'net salary change'),
    averageNet: number(record.averageNet, 'average net salary'),
    headcount: count(record.headcount, 'headcount'),
    departments: list(record.departments, 'department breakdown').map(departmentRow),
    trends: list(record.trends, 'salary trend').map(trendPoint),
    attendance: attendanceSummary(record.attendance),
    timeOff: timeOffSummary(record.timeOff),
    payrunStatusCounts: statusCounts(record.payrunStatusCounts, 'payrun status counts'),
    alerts: alerts(record.alerts),
    warnings: dashboardWarnings(record.warnings),
  }
}
