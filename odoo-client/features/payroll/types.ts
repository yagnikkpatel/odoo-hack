export const RULE_CATEGORIES = {
  basic: 'Basic',
  allowance: 'Allowance',
  gross: 'Gross',
  deduction: 'Deduction',
  contribution: 'Employer contribution',
  net: 'Net'
} as const
export const COMPUTATION_METHODS = { fixed: 'Fixed amount', percentage: 'Percentage', formula: 'Formula' } as const
export const PAYRUN_STATUSES = { draft: 'Draft', computed: 'Computed', validated: 'Validated', paid: 'Paid' } as const
export const EMPLOYMENT_TYPES = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  intern: 'Intern'
} as const
/** Inputs every formula can reference besides earlier rule codes. */
export const FORMULA_VARIABLES = [
  'WAGE',
  'PERIOD_DAYS',
  'PAID_DAYS',
  'UNPAID_DAYS',
  'EXPECTED_DAYS',
  'WORKED_DAYS',
  'WORKED_HOURS',
  'OVERTIME_HOURS'
] as const

export type RuleCategory = keyof typeof RULE_CATEGORIES
export type ComputationMethod = keyof typeof COMPUTATION_METHODS
export type PayrollStatus = keyof typeof PAYRUN_STATUSES
export type EmploymentType = keyof typeof EMPLOYMENT_TYPES
export type Result = { ok: true; id: string } | { ok: false; error: string }

export type SalaryRuleInput = {
  name: string
  code: string
  category: RuleCategory
  sequence: number
  method: ComputationMethod
  amount: number
  percentage: number
  base: string
  formula: string
  description: string
  active: boolean
}
export type SalaryRule = SalaryRuleInput & {
  id: string
  structureCount: number
  createdAt: string
  updatedAt: string
}
export type SalaryStructureInput = {
  name: string
  description: string
  active: boolean
  ruleIds: string[]
  sequences?: { ruleId: string; sequence: number }[]
}
export type SalaryStructure = {
  id: string
  name: string
  description: string
  active: boolean
  ruleIds: string[]
  ruleCount: number
  employeeCount: number
  payrunCount: number
  createdAt: string
  updatedAt: string
}
export type PayrollWarning = { code: string; message: string; employeeId?: string; blocking: boolean }
export type PayslipLine = {
  ruleId: string
  name: string
  code: string
  category: RuleCategory
  sequence: number
  amount: number
}
export type ContractSnapshot = {
  id: string
  startDate: string
  endDate: string
  wage: number
  employmentType: EmploymentType
  salaryStructureId: string | null
}
export type BankSnapshot = { accountHolder: string; accountNumberLast4: string; ifsc: string; bankName: string }
export type PayrunInput = { name: string; structureId: string; startDate: string; endDate: string; employeeIds: string[] }
export type Payrun = {
  id: string
  name: string
  structureId: string
  structureName: string
  startDate: string
  endDate: string
  status: PayrollStatus
  createdBy: string | null
  createdByName: string | null
  computedAt: string | null
  validatedAt: string | null
  paidAt: string | null
  sentAt: string | null
  payslipCount: number
  employeeIds: string[]
  totalGross: number
  totalNet: number
  warningCount: number
  blockingCount: number
  createdAt: string
  updatedAt: string
}
export type Payslip = {
  id: string
  payrunId: string
  payrunName: string
  employeeId: string
  status: PayrollStatus
  employeeName: string
  employeeEmail: string
  department: string
  jobPosition: string
  employmentType: EmploymentType
  structureId: string | null
  structureName: string
  startDate: string
  endDate: string
  currency: string
  periodDays: number
  paidDays: number
  unpaidDays: number
  expectedDays: number
  workedDays: number
  workedHours: number
  overtimeHours: number
  basic: number
  allowances: number
  deductions: number
  contributions: number
  gross: number
  net: number
  lines: PayslipLine[]
  warnings: PayrollWarning[]
  contractSnapshot: ContractSnapshot | null
  bankSnapshot: BankSnapshot | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}
export type PayrunDetail = { payrun: Payrun; payslips: Payslip[] }
export type EligibleEmployee = {
  employeeId: string
  name: string
  email: string
  department: string
  jobPosition: string
  employmentType: EmploymentType
  contractId: string
  contractStartDate: string
  contractEndDate: string
  wage: number
  contractStructureId: string | null
  contractStructureName: string | null
  structureMatches: boolean
  existingPayslipId: string | null
  hasBankDetails: boolean
}
export type BankDetailsInput = {
  accountHolder: string
  accountNumber: string
  ifsc: string
  bankName: string
  pan: string
  uan: string
}
export type BankDetails = BankDetailsInput & { employeeId: string; createdAt: string; updatedAt: string }
export type SendPayslipsResult = {
  transport: 'smtp' | 'log'
  sent: string[]
  skipped: { payslipId: string; employeeName: string; reason: string }[]
}
export type PayrollData = { rules: SalaryRule[]; structures: SalaryStructure[]; payruns: Payrun[]; payslips: Payslip[] }
export type DashboardFilters = { from: string; to: string; department: string; employmentType: string }
export type DashboardAlert = {
  kind: 'payrun' | 'bank' | 'duplicate' | 'contract' | 'warning'
  message: string
  payrunId?: string
  payrunName?: string
  employeeId?: string
}
export type PayrollDashboard = {
  filters: DashboardFilters & { departments: string[] }
  kpis: {
    netPaid: number
    payslipsGenerated: number
    averageNet: number
    approvedLeaveDays: number
    attendanceHealth: number | null
    headcount: number
  }
  costByDepartment: { department: string; headcount: number; gross: number; net: number }[]
  monthlyTrend: { month: string; net: number; gross: number; payslips: number }[]
  payrollStatus: Record<PayrollStatus, number>
  attendance: {
    present: number
    late: number
    absent: number
    overtimeHours: number
    missingCheckouts: number
    manualEdits: number
    scheduledDays: number
    coveredDays: number
    coverage: number | null
  }
  timeOff: {
    approvedDays: number
    approvedHours: number
    unpaidDays: number
    pendingRequests: number
    remainingBalanceDays: number
  }
  contracts: { withoutContract: number; expiringSoon: number; withoutStructure: number }
  alerts: DashboardAlert[]
}

export const money = (amount: number, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
export const count = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`)
  )
}
export const formatPeriod = (start: string, end: string) => `${formatDate(start)} – ${formatDate(end)}`
export function formatTimestamp(value: string | null) {
  if (!value) return ''
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
export const calculation = (rule: Pick<SalaryRule, 'method' | 'amount' | 'percentage' | 'base' | 'formula'>) =>
  rule.method === 'fixed'
    ? money(rule.amount)
    : rule.method === 'percentage'
      ? `${rule.percentage}% of ${rule.base}`
      : rule.formula
export const isLocked = (status: PayrollStatus) => status === 'validated' || status === 'paid'
