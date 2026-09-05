export const TIME_OFF_TYPES = [
  "paid_time_off",
  "sick_leave",
  "comp_off",
] as const;

export type TimeOffType = (typeof TIME_OFF_TYPES)[number];

export const TIME_OFF_STATUSES = ["pending", "approved", "rejected"] as const;

export type TimeOffStatus = (typeof TIME_OFF_STATUSES)[number];

/** Display names the UI shows for each type, kept next to the codes they map to. */
export const TIME_OFF_TYPE_LABELS: Record<TimeOffType, string> = {
  paid_time_off: "Paid Time Off",
  sick_leave: "Sick Leave",
  comp_off: "Comp Off",
};

/** A single request cannot span more than a year, whatever the client sends. */
export const MAX_TIME_OFF_DAYS = 365;

export type TimeOffRequestRecord = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  timeOffType: TimeOffType;
  timeOffTypeLabel: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string;
  status: TimeOffStatus;
  approverId: string | null;
  approverName: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type TimeOffListResult = {
  requests: TimeOffRequestRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};
