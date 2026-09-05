export const RULE_CATEGORIES = { basic: 'Basic', allowance: 'Allowance', gross: 'Gross', deduction: 'Deduction', contribution: 'Employer contribution', net: 'Net' } as const
export const COMPUTATION_METHODS = { fixed: 'Fixed amount', percentage: 'Percentage', formula: 'Formula' } as const
export const PAYRUN_STATUSES = { draft: 'Draft', computed: 'Computed', validated: 'Validated', paid: 'Paid' } as const
export type PayrollStatus = keyof typeof PAYRUN_STATUSES
export type SalaryRuleInput = { name: string; code: string; category: keyof typeof RULE_CATEGORIES; sequence: number; method: keyof typeof COMPUTATION_METHODS; amount: number; percentage: number; base: string; formula: string; active: boolean }
export type SalaryRule = SalaryRuleInput & { id: string }
export type SalaryStructureInput = { name: string; description: string; active: boolean; ruleIds: string[] }
export type SalaryStructure = SalaryStructureInput & { id: string }
export type PayrunInput = { name: string; structureId: string; startDate: string; endDate: string; employeeIds: string[] }
export type PayrollWarning = { code: string; message: string; employeeId?: string; blocking: boolean }
export type Payrun = PayrunInput & { id: string; structureName: string; status: PayrollStatus; createdAt: string; computedAt?: string; validatedAt?: string; paidAt?: string; warnings: PayrollWarning[] }
export type PayslipLine = { ruleId: string; name: string; code: string; category: keyof typeof RULE_CATEGORIES; sequence: number; amount: number }
export type Payslip = { id: string; payrunId: string; employeeId: string; employeeName: string; employeeEmail: string; department: string; employmentType: string; structureId: string; structureName: string; startDate: string; endDate: string; status: PayrollStatus; currency: string; workedDays: number; workedHours: number; expectedDays: number; expectedHours: number; basic: number; allowances: number; deductions: number; contributions: number; gross: number; net: number; lines: PayslipLine[]; warnings: PayrollWarning[]; contractSnapshot?: import('@/features/contracts/types').Contract; bankAccount?: string }
export type PayrollResult = { ok: true; id: string } | { ok: false; error: string }
export const money = (amount: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount)
