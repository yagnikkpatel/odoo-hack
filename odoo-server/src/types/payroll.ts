export const RULE_CATEGORIES = [
  "basic",
  "allowance",
  "gross",
  "deduction",
  "contribution",
  "net",
] as const;

export const COMPUTATION_METHODS = ["fixed", "percentage", "formula"] as const;

export const PAYRUN_STATUSES = ["draft", "computed", "validated", "paid"] as const;

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "intern",
] as const;

export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export type ComputationMethod = (typeof COMPUTATION_METHODS)[number];

export type PayrunStatus = (typeof PAYRUN_STATUSES)[number];

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

/** Payroll amounts are Indian rupees; contract wages are monthly. */
export const PAYROLL_CURRENCY = "INR";

/** Fallback working day used to convert hourly leave into days. */
export const HOURS_PER_DAY = 8;

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
  description: string;
  active: boolean;
  structureCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SalaryStructureRecord = {
  id: string;
  name: string;
  description: string;
  active: boolean;
  ruleIds: string[];
  ruleCount: number;
  employeeCount: number;
  payrunCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PayrollWarning = {
  code: string;
  message: string;
  employeeId?: string;
  blocking: boolean;
};

export type PayslipLine = {
  ruleId: string;
  name: string;
  code: string;
  category: RuleCategory;
  sequence: number;
  amount: number;
};

export type ContractSnapshot = {
  id: string;
  startDate: string;
  endDate: string;
  wage: number;
  employmentType: EmploymentType;
  salaryStructureId: string | null;
};

export type BankSnapshot = {
  accountHolder: string;
  accountNumberLast4: string;
  ifsc: string;
  bankName: string;
};

export type PayrunRecord = {
  id: string;
  name: string;
  structureId: string;
  structureName: string;
  startDate: string;
  endDate: string;
  status: PayrunStatus;
  createdBy: string | null;
  createdByName: string | null;
  computedAt: Date | null;
  validatedAt: Date | null;
  paidAt: Date | null;
  sentAt: Date | null;
  payslipCount: number;
  employeeIds: string[];
  totalGross: number;
  totalNet: number;
  warningCount: number;
  blockingCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PayslipRecord = {
  id: string;
  payrunId: string;
  payrunName: string;
  employeeId: string;
  status: PayrunStatus;
  employeeName: string;
  employeeEmail: string;
  department: string;
  jobPosition: string;
  employmentType: EmploymentType;
  structureId: string | null;
  structureName: string;
  startDate: string;
  endDate: string;
  currency: string;
  periodDays: number;
  paidDays: number;
  unpaidDays: number;
  expectedDays: number;
  workedDays: number;
  workedHours: number;
  overtimeHours: number;
  basic: number;
  allowances: number;
  deductions: number;
  contributions: number;
  gross: number;
  net: number;
  lines: PayslipLine[];
  warnings: PayrollWarning[];
  contractSnapshot: ContractSnapshot | null;
  bankSnapshot: BankSnapshot | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PayrunDetail = {
  payrun: PayrunRecord;
  payslips: PayslipRecord[];
};

export type BankDetailsRecord = {
  employeeId: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  bankName: string;
  pan: string;
  uan: string;
  createdAt: Date;
  updatedAt: Date;
};

export type EligibleEmployee = {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  jobPosition: string;
  employmentType: EmploymentType;
  contractId: string;
  contractStartDate: string;
  contractEndDate: string;
  wage: number;
  contractStructureId: string | null;
  contractStructureName: string | null;
  structureMatches: boolean;
  existingPayslipId: string | null;
  hasBankDetails: boolean;
};

export type SendPayslipsResult = {
  transport: "smtp" | "log";
  sent: string[];
  skipped: { payslipId: string; employeeName: string; reason: string }[];
};

export type PayrollSnapshot = {
  rules: SalaryRuleRecord[];
  structures: SalaryStructureRecord[];
  payruns: PayrunRecord[];
  payslips: PayslipRecord[];
};

export type DashboardAlert = {
  kind: "payrun" | "bank" | "duplicate" | "contract" | "warning";
  message: string;
  payrunId?: string;
  payrunName?: string;
  employeeId?: string;
};

export type PayrollDashboard = {
  filters: {
    from: string;
    to: string;
    department: string;
    employmentType: string;
    departments: string[];
  };
  kpis: {
    netPaid: number;
    payslipsGenerated: number;
    averageNet: number;
    approvedLeaveDays: number;
    attendanceHealth: number | null;
    headcount: number;
  };
  costByDepartment: {
    department: string;
    headcount: number;
    gross: number;
    net: number;
  }[];
  monthlyTrend: { month: string; net: number; gross: number; payslips: number }[];
  payrollStatus: Record<PayrunStatus, number>;
  attendance: {
    present: number;
    late: number;
    absent: number;
    overtimeHours: number;
    missingCheckouts: number;
    manualEdits: number;
    scheduledDays: number;
    coveredDays: number;
    coverage: number | null;
  };
  timeOff: {
    approvedDays: number;
    approvedHours: number;
    unpaidDays: number;
    pendingRequests: number;
    remainingBalanceDays: number;
  };
  contracts: {
    withoutContract: number;
    expiringSoon: number;
    withoutStructure: number;
  };
  alerts: DashboardAlert[];
};
