export const RULE_CATEGORIES = [
  "basic",
  "allowance",
  "gross",
  "deduction",
  "contribution",
  "net",
] as const;

export const COMPUTATION_METHODS = ["fixed", "percentage", "formula"] as const;

export const PAYROLL_STATUSES = [
  "draft",
  "computed",
  "validated",
  "paid",
] as const;

export const WAGE_PERIODS = ["month", "year", "hour"] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];
export type ComputationMethod = (typeof COMPUTATION_METHODS)[number];
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];
export type WagePeriod = (typeof WAGE_PERIODS)[number];

/**
 * Inputs a salary rule may reference by code. They are reserved: a rule cannot
 * take one of these codes for itself.
 */
export const FORMULA_VARIABLES = [
  "WAGE",
  "WORKED_DAYS",
  "WORKED_HOURS",
  "OVERTIME_HOURS",
  "EXPECTED_DAYS",
  "EXPECTED_HOURS",
  "UNPAID_DAYS",
  "PERIOD_DAYS",
] as const;

export type SalaryRuleRecord = {
  id: string;
  name: string;
  code: string;
  category: RuleCategory;
  sequence: number;
  method: ComputationMethod;
  amount: number;
  percentage: number;
  base: string;
  formula: string;
  /** Multiplies the computed result, so one rule can express "this, N times". */
  quantity: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type SalaryStructureRecord = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  ruleIds: string[];
  employeeCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PayrollWarning = {
  code: string;
  message: string;
  employeeId?: string;
  blocking: boolean;
};

export type PayrunRecord = {
  id: string;
  name: string;
  structureId: string;
  structureName: string;
  startDate: string;
  endDate: string;
  status: PayrollStatus;
  employeeIds: string[];
  payslipCount: number;
  warnings: PayrollWarning[];
  computedAt: Date | null;
  validatedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PayslipLine = {
  ruleId: string;
  name: string;
  code: string;
  category: RuleCategory;
  sequence: number;
  amount: number;
};

/** The contract terms a payslip was calculated from, frozen on the payslip. */
export type ContractSnapshot = {
  id: string;
  startDate: string;
  endDate: string;
  wage: number;
  currency: string;
  wagePeriod: WagePeriod;
  status: string;
};

export type PayslipRecord = {
  id: string;
  payrunId: string;
  payrunName: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  department: string;
  jobPosition: string;
  structureId: string;
  structureName: string;
  startDate: string;
  endDate: string;
  status: PayrollStatus;
  currency: string;
  workedDays: number;
  workedHours: number;
  expectedDays: number;
  expectedHours: number;
  basic: number;
  allowances: number;
  deductions: number;
  contributions: number;
  gross: number;
  net: number;
  bankAccount: string;
  contractSnapshot: ContractSnapshot | null;
  lines: PayslipLine[];
  warnings: PayrollWarning[];
  createdAt: Date;
  updatedAt: Date;
};

/** A payroll-eligible employee shown in the payrun employee selection step. */
export type PayrollEmployeeOption = {
  id: string;
  name: string;
  email: string;
  department: string;
  jobPosition: string;
  workingSchedule: string;
  contractId: string;
  startDate: string;
  endDate: string;
  wage: number;
  currency: string;
  wagePeriod: WagePeriod;
  bankAccount: string;
};

export type Pagination = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export type SalaryRuleListResult = {
  rules: SalaryRuleRecord[];
  pagination: Pagination;
};

export type SalaryStructureListResult = {
  structures: SalaryStructureRecord[];
  pagination: Pagination;
};

export type PayrunListResult = {
  payruns: PayrunRecord[];
  pagination: Pagination;
};

export type PayslipListResult = {
  payslips: PayslipRecord[];
  pagination: Pagination;
};

export const DELIVERY_STATUSES = [
  "queued",
  "sending",
  "sent",
  "failed",
] as const;

export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** The outcome of emailing one payslip, as the payroll screen reads it back. */
export type PayslipDeliveryRecord = {
  id: string;
  payslipId: string;
  payrunId: string;
  employeeId: string;
  employeeName: string;
  recipient: string;
  status: DeliveryStatus;
  attempts: number;
  error: string;
  queuedAt: Date;
  sentAt: Date | null;
  updatedAt: Date;
};

/** Why one payslip was left out of a send, reported back per payslip. */
export type DeliverySkip = {
  payslipId: string;
  employeeName: string;
  reason: string;
};

export type DeliveryDispatchResult = {
  payrunId: string;
  queued: PayslipDeliveryRecord[];
  skipped: DeliverySkip[];
};

/**
 * Payroll dashboard. Every figure below is an aggregate the database computes
 * for one period and one currency: the dashboard reads payroll together with
 * the HR modules it depends on (employees, contracts, attendance, time off),
 * which is more data than any screen should pull down record by record.
 */

/** Payslip and employee grouping label used when a record carries no department. */
export const UNASSIGNED_GROUP = "Not assigned";

export type PayrollDashboardTotals = {
  payslips: number;
  netPaid: number;
  grossPaid: number;
  deductionsPaid: number;
  employeesPaid: number;
  /** Payslips in the period by status, so the status split needs no second read. */
  statusCounts: Record<PayrollStatus, number>;
};

export type PayrollDepartmentRow = {
  department: string;
  /** Employees on the books today, not a headcount frozen at period end. */
  headcount: number;
  payslips: number;
  net: number;
  gross: number;
};

export type PayrollTrendPoint = {
  /** YYYY-MM of the payroll period end, the month payroll is reported in. */
  month: string;
  net: number;
  payslips: number;
};

/**
 * Attendance quality for the period. There is no working-schedule table, so
 * these are the recorded facts -- present/absent/incomplete, overtime and the
 * corrections an HR user made -- and never a comparison against a roster.
 */
export type PayrollAttendanceSummary = {
  records: number;
  employees: number;
  present: number;
  absent: number;
  incomplete: number;
  missingCheckOuts: number;
  manualEdits: number;
  workedHours: number;
  overtimeHours: number;
  /** Present share of reviewed records; null when the period has no records. */
  coverage: number | null;
};

export type PayrollTimeOffRow = {
  typeId: string;
  name: string;
  unit: "days" | "hours";
  paid: boolean;
  /** Approved leave charged inside the period, in the type's own unit. */
  approved: number;
  pendingRequests: number;
  /** Balance at period end; null for types taken without an allocation. */
  remaining: number | null;
};

export type PayrollTimeOffSummary = {
  approvedDays: number;
  approvedHours: number;
  unpaidDays: number;
  unpaidHours: number;
  pendingRequests: number;
  remainingDays: number;
  remainingHours: number;
  types: PayrollTimeOffRow[];
};

/** A payroll condition the operator has to act on, counted rather than listed. */
export type PayrollAlert = {
  code: string;
  message: string;
  count: number;
  blocking: boolean;
};

export type PayrollDashboard = {
  period: {
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
  };
  currency: string;
  filters: {
    departments: string[];
    jobPositions: string[];
    currencies: string[];
  };
  totals: PayrollDashboardTotals;
  /** The same period, immediately before this one, for the paid-salary delta. */
  previous: { netPaid: number; payslips: number };
  /** Percentage change against the previous period; null when it paid nothing. */
  netPaidChange: number | null;
  averageNet: number;
  headcount: number;
  departments: PayrollDepartmentRow[];
  trends: PayrollTrendPoint[];
  attendance: PayrollAttendanceSummary;
  timeOff: PayrollTimeOffSummary;
  payrunStatusCounts: Record<PayrollStatus, number>;
  alerts: PayrollAlert[];
  /** Warnings the payruns overlapping this period recorded when they computed. */
  warnings: (PayrollWarning & { payrunId: string; payrunName: string })[];
};
