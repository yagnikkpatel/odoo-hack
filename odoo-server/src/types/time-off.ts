export const LEAVE_UNITS = ["days", "hours"] as const;

export const APPROVAL_POLICIES = ["manager", "none"] as const;

export const PAYROLL_TREATMENTS = ["paid", "unpaid"] as const;

export const ALLOCATION_STATUSES = ["pending", "approved", "refused"] as const;

export const REQUEST_STATUSES = [
  "pending",
  "approved",
  "refused",
  "cancelled",
] as const;

export type LeaveUnit = (typeof LEAVE_UNITS)[number];

export type ApprovalPolicy = (typeof APPROVAL_POLICIES)[number];

export type PayrollTreatment = (typeof PAYROLL_TREATMENTS)[number];

export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

/**
 * The Working Schedules module has no backend yet, so every employee falls back
 * to Mon-Fri 09:00-18:00 with a 60 minute break -- 8 net hours a day. The client
 * documents the same fallback in features/time-off/logic.ts, so both sides agree
 * on the durations they compute. Replace this with the employee's assigned
 * calendar once Working Schedules ships.
 */
export const DEFAULT_WORKDAY_START = "09:00";

export const DEFAULT_WORKDAY_END = "18:00";

export const DEFAULT_BREAK_MINUTES = 60;

/** A request may not span more than a year of calendar days. */
export const MAX_REQUEST_DAYS = 366;

export type Decision = {
  at: string;
  actorId?: string;
  action: string;
  reason?: string;
};

export type DayCharge = {
  date: string;
  amount: number;
};

export type Consumption = DayCharge & {
  allocationId: string;
};

export type TimeOffTypeRecord = {
  id: string;
  name: string;
  code: string;
  unit: LeaveUnit;
  requiresAllocation: boolean;
  approval: ApprovalPolicy;
  payroll: PayrollTreatment;
  active: boolean;
  description: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AllocationRecord = {
  id: string;
  employeeId: string;
  typeId: string;
  amount: number;
  validFrom: string;
  /** '' when open-ended; the column is NULL. */
  validTo: string;
  note: string;
  status: AllocationStatus;
  history: Decision[];
  createdAt: Date;
  updatedAt: Date;
};

export type TimeOffRequestRecord = {
  id: string;
  employeeId: string;
  typeId: string;
  startDate: string;
  endDate: string;
  /** '' for the days unit, 'HH:MM' for the hours unit. */
  startTime: string;
  endTime: string;
  reason: string;
  unit: LeaveUnit;
  duration: number;
  charges: DayCharge[];
  consumptions: Consumption[];
  status: RequestStatus;
  history: Decision[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * The whole module in one payload. Balance and consumption maths spans all three
 * collections, so the client reads them together rather than page by page.
 */
export type TimeOffSnapshot = {
  types: TimeOffTypeRecord[];
  allocations: AllocationRecord[];
  requests: TimeOffRequestRecord[];
};
