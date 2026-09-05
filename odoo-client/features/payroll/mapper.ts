import { ApiError } from '@/lib/api-client'
import { COMPUTATION_METHODS, EMPLOYMENT_TYPES, PAYRUN_STATUSES, RULE_CATEGORIES } from './types'
import type {
  BankDetails,
  ComputationMethod,
  EligibleEmployee,
  EmploymentType,
  PayrollDashboard,
  PayrollData,
  PayrollStatus,
  PayrollWarning,
  Payrun,
  PayrunDetail,
  Payslip,
  PayslipLine,
  RuleCategory,
  SalaryRule,
  SalaryStructure,
  SendPayslipsResult
} from './types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/

function invalid(field = 'response'): never {
  throw new ApiError(`The payroll service returned an invalid ${field}.`, 502)
}
export function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  return value as Record<string, unknown>
}
export function requirePayrollId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new ApiError('A valid payroll ID is required.', 400)
  return value
}
const id = (value: unknown, field: string) => (typeof value === 'string' && UUID.test(value) ? value : invalid(field))
const nullableId = (value: unknown, field: string) => (value === null || value === undefined ? null : id(value, field))
const text = (value: unknown, field: string) => (typeof value === 'string' ? value : invalid(field))
const nullableText = (value: unknown, field: string) =>
  value === null || value === undefined ? null : text(value, field)
const number = (value: unknown, field: string) =>
  typeof value === 'number' && Number.isFinite(value) ? value : invalid(field)
const flag = (value: unknown, field: string) => (typeof value === 'boolean' ? value : invalid(field))
const date = (value: unknown, field: string) => (typeof value === 'string' && DATE.test(value) ? value : invalid(field))
const timestamp = (value: unknown, field: string) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : invalid(field)
const nullableTimestamp = (value: unknown, field: string) =>
  value === null || value === undefined ? null : timestamp(value, field)
const list = (value: unknown, field: string) => (Array.isArray(value) ? (value as unknown[]) : invalid(field))
function member<T extends string>(value: unknown, allowed: Record<T, string>, field: string): T {
  if (typeof value !== 'string' || !Object.hasOwn(allowed, value)) invalid(field)
  return value as T
}

export function mapRule(value: unknown): SalaryRule {
  const record = requireRecord(value)
  return {
    id: id(record.id, 'rule id'),
    name: text(record.name, 'rule name'),
    code: text(record.code, 'rule code'),
    category: member<RuleCategory>(record.category, RULE_CATEGORIES, 'rule category'),
    sequence: number(record.sequence, 'rule sequence'),
    method: member<ComputationMethod>(record.method, COMPUTATION_METHODS, 'rule method'),
    amount: number(record.amount, 'rule amount'),
    percentage: number(record.percentage, 'rule percentage'),
    base: text(record.base, 'rule base'),
    formula: text(record.formula, 'rule formula'),
    description: text(record.description, 'rule description'),
    active: flag(record.active, 'rule status'),
    structureCount: number(record.structureCount, 'rule usage'),
    createdAt: timestamp(record.createdAt, 'timestamp'),
    updatedAt: timestamp(record.updatedAt, 'timestamp')
  }
}
export function mapStructure(value: unknown): SalaryStructure {
  const record = requireRecord(value)
  return {
    id: id(record.id, 'structure id'),
    name: text(record.name, 'structure name'),
    description: text(record.description, 'structure description'),
    active: flag(record.active, 'structure status'),
    ruleIds: list(record.ruleIds, 'structure rules').map(item => id(item, 'structure rule')),
    ruleCount: number(record.ruleCount, 'rule count'),
    employeeCount: number(record.employeeCount, 'employee count'),
    payrunCount: number(record.payrunCount, 'payrun count'),
    createdAt: timestamp(record.createdAt, 'timestamp'),
    updatedAt: timestamp(record.updatedAt, 'timestamp')
  }
}
function mapWarning(value: unknown): PayrollWarning {
  const record = requireRecord(value)
  const warning: PayrollWarning = {
    code: text(record.code, 'warning code'),
    message: text(record.message, 'warning message'),
    blocking: flag(record.blocking, 'warning severity')
  }
  if (typeof record.employeeId === 'string') warning.employeeId = record.employeeId
  return warning
}
function mapLine(value: unknown): PayslipLine {
  const record = requireRecord(value)
  return {
    ruleId: text(record.ruleId, 'line rule'),
    name: text(record.name, 'line name'),
    code: text(record.code, 'line code'),
    category: member<RuleCategory>(record.category, RULE_CATEGORIES, 'line category'),
    sequence: number(record.sequence, 'line sequence'),
    amount: number(record.amount, 'line amount')
  }
}
export function mapPayrun(value: unknown): Payrun {
  const record = requireRecord(value)
  return {
    id: id(record.id, 'payrun id'),
    name: text(record.name, 'payrun name'),
    structureId: id(record.structureId, 'payrun structure'),
    structureName: text(record.structureName, 'payrun structure name'),
    startDate: date(record.startDate, 'payrun start'),
    endDate: date(record.endDate, 'payrun end'),
    status: member<PayrollStatus>(record.status, PAYRUN_STATUSES, 'payrun status'),
    createdBy: nullableId(record.createdBy, 'payrun author'),
    createdByName: nullableText(record.createdByName, 'payrun author'),
    computedAt: nullableTimestamp(record.computedAt, 'timestamp'),
    validatedAt: nullableTimestamp(record.validatedAt, 'timestamp'),
    paidAt: nullableTimestamp(record.paidAt, 'timestamp'),
    sentAt: nullableTimestamp(record.sentAt, 'timestamp'),
    payslipCount: number(record.payslipCount, 'payslip count'),
    employeeIds: list(record.employeeIds, 'payrun employees').map(item => id(item, 'payrun employee')),
    totalGross: number(record.totalGross, 'payrun gross'),
    totalNet: number(record.totalNet, 'payrun net'),
    warningCount: number(record.warningCount, 'warning count'),
    blockingCount: number(record.blockingCount, 'warning count'),
    createdAt: timestamp(record.createdAt, 'timestamp'),
    updatedAt: timestamp(record.updatedAt, 'timestamp')
  }
}
export function mapPayslip(value: unknown): Payslip {
  const record = requireRecord(value)
  const contract = record.contractSnapshot ? requireRecord(record.contractSnapshot) : null
  const bank = record.bankSnapshot ? requireRecord(record.bankSnapshot) : null
  return {
    id: id(record.id, 'payslip id'),
    payrunId: id(record.payrunId, 'payslip payrun'),
    payrunName: text(record.payrunName, 'payslip payrun name'),
    employeeId: id(record.employeeId, 'payslip employee'),
    status: member<PayrollStatus>(record.status, PAYRUN_STATUSES, 'payslip status'),
    employeeName: text(record.employeeName, 'employee name'),
    employeeEmail: text(record.employeeEmail, 'employee email'),
    department: text(record.department, 'department'),
    jobPosition: text(record.jobPosition, 'job position'),
    employmentType: member<EmploymentType>(record.employmentType, EMPLOYMENT_TYPES, 'employment type'),
    structureId: nullableId(record.structureId, 'payslip structure'),
    structureName: text(record.structureName, 'structure name'),
    startDate: date(record.startDate, 'payslip start'),
    endDate: date(record.endDate, 'payslip end'),
    currency: text(record.currency, 'currency'),
    periodDays: number(record.periodDays, 'period days'),
    paidDays: number(record.paidDays, 'paid days'),
    unpaidDays: number(record.unpaidDays, 'unpaid days'),
    expectedDays: number(record.expectedDays, 'expected days'),
    workedDays: number(record.workedDays, 'worked days'),
    workedHours: number(record.workedHours, 'worked hours'),
    overtimeHours: number(record.overtimeHours, 'overtime hours'),
    basic: number(record.basic, 'basic'),
    allowances: number(record.allowances, 'allowances'),
    deductions: number(record.deductions, 'deductions'),
    contributions: number(record.contributions, 'contributions'),
    gross: number(record.gross, 'gross'),
    net: number(record.net, 'net'),
    lines: list(record.lines, 'payslip lines').map(mapLine),
    warnings: list(record.warnings, 'payslip warnings').map(mapWarning),
    contractSnapshot: contract
      ? {
          id: text(contract.id, 'contract id'),
          startDate: date(contract.startDate, 'contract start'),
          endDate: date(contract.endDate, 'contract end'),
          wage: number(contract.wage, 'contract wage'),
          employmentType: member<EmploymentType>(contract.employmentType, EMPLOYMENT_TYPES, 'employment type'),
          salaryStructureId: nullableId(contract.salaryStructureId, 'contract structure')
        }
      : null,
    bankSnapshot: bank
      ? {
          accountHolder: text(bank.accountHolder, 'bank holder'),
          accountNumberLast4: text(bank.accountNumberLast4, 'bank account'),
          ifsc: text(bank.ifsc, 'bank ifsc'),
          bankName: text(bank.bankName, 'bank name')
        }
      : null,
    sentAt: nullableTimestamp(record.sentAt, 'timestamp'),
    createdAt: timestamp(record.createdAt, 'timestamp'),
    updatedAt: timestamp(record.updatedAt, 'timestamp')
  }
}
export function mapPayrunDetail(value: unknown): PayrunDetail {
  const record = requireRecord(value)
  return { payrun: mapPayrun(record.payrun), payslips: list(record.payslips, 'payslip list').map(mapPayslip) }
}
export function mapEligibleEmployee(value: unknown): EligibleEmployee {
  const record = requireRecord(value)
  return {
    employeeId: id(record.employeeId, 'employee id'),
    name: text(record.name, 'employee name'),
    email: text(record.email, 'employee email'),
    department: text(record.department, 'department'),
    jobPosition: text(record.jobPosition, 'job position'),
    employmentType: member<EmploymentType>(record.employmentType, EMPLOYMENT_TYPES, 'employment type'),
    contractId: id(record.contractId, 'contract id'),
    contractStartDate: date(record.contractStartDate, 'contract start'),
    contractEndDate: date(record.contractEndDate, 'contract end'),
    wage: number(record.wage, 'wage'),
    contractStructureId: nullableId(record.contractStructureId, 'contract structure'),
    contractStructureName: nullableText(record.contractStructureName, 'contract structure name'),
    structureMatches: flag(record.structureMatches, 'structure match'),
    existingPayslipId: nullableId(record.existingPayslipId, 'existing payslip'),
    hasBankDetails: flag(record.hasBankDetails, 'bank flag')
  }
}
export function mapBankDetails(value: unknown): BankDetails | null {
  if (value === null || value === undefined) return null
  const record = requireRecord(value)
  return {
    employeeId: id(record.employeeId, 'employee id'),
    accountHolder: text(record.accountHolder, 'account holder'),
    accountNumber: text(record.accountNumber, 'account number'),
    ifsc: text(record.ifsc, 'ifsc'),
    bankName: text(record.bankName, 'bank name'),
    pan: text(record.pan, 'pan'),
    uan: text(record.uan, 'uan'),
    createdAt: timestamp(record.createdAt, 'timestamp'),
    updatedAt: timestamp(record.updatedAt, 'timestamp')
  }
}
export function mapSendResult(value: unknown): SendPayslipsResult {
  const record = requireRecord(value)
  if (record.transport !== 'smtp' && record.transport !== 'log') invalid('delivery transport')
  return {
    transport: record.transport as 'smtp' | 'log',
    sent: list(record.sent, 'sent list').map(item => id(item, 'sent payslip')),
    skipped: list(record.skipped, 'skipped list').map(item => {
      const entry = requireRecord(item)
      return {
        payslipId: id(entry.payslipId, 'skipped payslip'),
        employeeName: text(entry.employeeName, 'employee name'),
        reason: text(entry.reason, 'skip reason')
      }
    })
  }
}
export function mapSnapshot(value: unknown): PayrollData {
  const record = requireRecord(value)
  return {
    rules: list(record.rules, 'rule list').map(mapRule),
    structures: list(record.structures, 'structure list').map(mapStructure),
    payruns: list(record.payruns, 'payrun list').map(mapPayrun),
    payslips: list(record.payslips, 'payslip list').map(mapPayslip)
  }
}
// The dashboard is read-only display data; shape checks stay at the top level.
export function mapDashboard(value: unknown): PayrollDashboard {
  const record = requireRecord(value)
  for (const key of ['filters', 'kpis', 'attendance', 'timeOff', 'contracts', 'payrollStatus']) requireRecord(record[key])
  for (const key of ['costByDepartment', 'monthlyTrend', 'alerts']) list(record[key], key)
  return record as unknown as PayrollDashboard
}
