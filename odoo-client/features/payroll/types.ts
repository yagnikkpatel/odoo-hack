export const RULE_CATEGORIES = { basic: 'Basic', allowance: 'Allowance', gross: 'Gross', deduction: 'Deduction', contribution: 'Employer contribution', net: 'Net' } as const
export const COMPUTATION_METHODS = { fixed: 'Fixed amount', percentage: 'Percentage', formula: 'Formula' } as const
export const PAYRUN_STATUSES = { draft: 'Draft', computed: 'Computed', validated: 'Validated', paid: 'Paid' } as const
export type PayrollStatus = keyof typeof PAYRUN_STATUSES
export type SalaryRuleInput = { name: string; code: string; category: keyof typeof RULE_CATEGORIES; sequence: number; method: keyof typeof COMPUTATION_METHODS; amount: number; percentage: number; base: string; formula: string; quantity?: number; active: boolean }
export type SalaryRule = SalaryRuleInput & { id: string }
export type SalaryStructureInput = { name: string; description: string; active: boolean; ruleIds: string[] }
export type SalaryStructure = SalaryStructureInput & { id: string; employeeCount?: number }
export type PayrunInput = { name: string; structureId: string; startDate: string; endDate: string; employeeIds: string[] }
export type PayrollWarning = { code: string; message: string; employeeId?: string; blocking: boolean }
export type Payrun = PayrunInput & { id: string; structureName: string; payslipCount?: number; status: PayrollStatus; createdAt: string; computedAt?: string; validatedAt?: string; paidAt?: string; warnings: PayrollWarning[] }
export type PayslipLine = { ruleId: string; name: string; code: string; category: keyof typeof RULE_CATEGORIES; sequence: number; amount: number }
export type Payslip = { id: string; payrunId: string; payrunName?: string; employeeId: string; employeeName: string; employeeEmail: string; department: string; employmentType?: string; jobPosition?: string; structureId: string; structureName: string; startDate: string; endDate: string; status: PayrollStatus; currency: string; workedDays: number; workedHours: number; expectedDays: number; expectedHours: number; basic: number; allowances: number; deductions: number; contributions: number; gross: number; net: number; lines: PayslipLine[]; warnings: PayrollWarning[]; contractSnapshot?: PayrollContractSnapshot | import('./contract-input').PayrollContractInput; bankAccount?: string }
export type PayrollResult = { ok: true; id: string } | { ok: false; error: string }
export const money = (amount: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)

export const DELIVERY_STATUSES = { queued: 'Queued', sending: 'Sending', sent: 'Sent', failed: 'Failed' } as const
export type DeliveryStatus = keyof typeof DELIVERY_STATUSES
export type PayrollContractSnapshot = { id: string; startDate: string; endDate: string; wage: number; currency: string; wagePeriod: 'month' | 'year' | 'hour'; status: string }
export type PayrollEmployeeOption = Omit<PayrollContractSnapshot, 'status'> & { name: string; email: string; department: string; jobPosition: string; workingSchedule: string; contractId: string; bankAccount: string }
export type PayrollPagination = { total: number; limit: number; offset: number; hasMore: boolean }
export type PayslipDelivery = { id: string; payslipId: string; payrunId: string; employeeId: string; employeeName: string; recipient: string; status: DeliveryStatus; attempts: number; error: string; queuedAt: string; sentAt?: string }
export type DeliverySkip = { payslipId: string; employeeName: string; reason: string }
export type DeliveryDispatch = { payrunId: string; queued: PayslipDelivery[]; skipped: DeliverySkip[] }
export type { DashboardQuery as PayrollDashboardQuery, DashboardData as PayrollDashboard, DashboardDepartment as PayrollDepartmentRow, DashboardTrend as PayrollTrendPoint, DashboardLeaveType as PayrollTimeOffRow, DashboardAlert as PayrollAlert, DashboardWarning as PayrollDashboardWarning } from '@/features/dashboard/types'
export type PayrollAttendanceSummary = import('@/features/dashboard/types').DashboardData['attendance']
export type PayrollTimeOffSummary = import('@/features/dashboard/types').DashboardData['timeOff']
