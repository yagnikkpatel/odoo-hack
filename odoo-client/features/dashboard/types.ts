export type DashboardQuery = {
  startDate: string
  endDate: string
  currency: string
  department?: string
  jobPosition?: string
}

export type DashboardStatusCounts = Record<'draft' | 'computed' | 'validated' | 'paid', number>
export type DashboardDepartment = { department: string; headcount: number; payslips: number; net: number; gross: number }
export type DashboardTrend = { month: string; net: number; payslips: number }
export type DashboardLeaveType = {
  typeId: string
  name: string
  unit: 'days' | 'hours'
  paid: boolean
  approved: number
  pendingRequests: number
  remaining: number | null
}
export type DashboardAlert = { code: string; message: string; count: number; blocking: boolean }
export type DashboardWarning = { code: string; message: string; employeeId?: string; blocking: boolean; payrunId: string; payrunName: string }

/** Database aggregates over the requested period, never the current table page. */
export type DashboardData = {
  period: { startDate: string; endDate: string; previousStartDate: string; previousEndDate: string }
  currency: string
  filters: { departments: string[]; jobPositions: string[]; currencies: string[] }
  totals: { payslips: number; netPaid: number; grossPaid: number; deductionsPaid: number; employeesPaid: number; statusCounts: DashboardStatusCounts }
  previous: { netPaid: number; payslips: number }
  netPaidChange: number | null
  averageNet: number
  /** Current employee directory headcount, not historical headcount. */
  headcount: number
  departments: DashboardDepartment[]
  trends: DashboardTrend[]
  attendance: {
    records: number; employees: number; present: number; absent: number; incomplete: number
    missingCheckOuts: number; manualEdits: number; workedHours: number; overtimeHours: number
    /** Present share of recorded attendance; not roster coverage. */
    coverage: number | null
  }
  timeOff: {
    approvedDays: number; approvedHours: number; unpaidDays: number; unpaidHours: number
    pendingRequests: number; remainingDays: number; remainingHours: number; types: DashboardLeaveType[]
  }
  payrunStatusCounts: DashboardStatusCounts
  alerts: DashboardAlert[]
  warnings: DashboardWarning[]
}
