import { AppError } from "../errors/AppError";
import { expectedWorkingDays } from "../lib/payroll-engine";
import {
  findConsumedAllocations,
  findDashboardAllocations,
  findDashboardAttendance,
  findDashboardEmployees,
  findDashboardLeave,
  findDashboardPayslips,
  findPaidTrend,
} from "../repositories/payroll.repository";
import { ATTENDANCE_TIMEZONE } from "../types/attendance";
import { DEFAULT_WORKDAY_START } from "../types/time-off";
import { DashboardQuery } from "../types/payroll.dto";
import { DashboardAlert, HOURS_PER_DAY, PayrollDashboard } from "../types/payroll";

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/** Check-ins up to this long after the workday start are not counted as late. */
const LATE_GRACE_MINUTES = 10;

function lateThreshold(workdayStart: string, graceMinutes: number): string {
  const [hours, minutes] = workdayStart.split(":").map(Number);
  const total = hours * 60 + minutes + graceMinutes;

  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function todayInIndia(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ATTENDANCE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function shiftMonths(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));

  return date.toISOString().slice(0, 7);
}

function addDays(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);

  return next.toISOString().slice(0, 10);
}

export async function getPayrollDashboard(
  query: DashboardQuery,
): Promise<PayrollDashboard> {
  const today = todayInIndia();
  const from = query.from ?? `${today.slice(0, 7)}-01`;
  const to = query.to ?? today;

  if (to < from) {
    throw new AppError(400, "to must be on or after from");
  }

  const department = query.department?.trim() ?? "";
  const employmentType = query.employmentType ?? "";

  const allEmployees = await findDashboardEmployees(from, to);
  const departments = [
    ...new Set(allEmployees.map((employee) => employee.department).filter(Boolean)),
  ].sort();
  const employees = allEmployees.filter(
    (employee) =>
      (!department || employee.department === department) &&
      (!employmentType || employee.employmentType === employmentType),
  );
  const employeeIds = employees.map((employee) => employee.id);
  const employeeIdSet = new Set(employeeIds);

  const [allPayslips, trendRows, attendanceRows, leaveRows, allocations] =
    await Promise.all([
      findDashboardPayslips(from, to),
      findPaidTrend(shiftMonths(to.slice(0, 7), -11), to.slice(0, 7)),
      findDashboardAttendance(
        employeeIds,
        from,
        to,
        ATTENDANCE_TIMEZONE,
        lateThreshold(DEFAULT_WORKDAY_START, LATE_GRACE_MINUTES),
      ),
      findDashboardLeave(employeeIds, from, to),
      findDashboardAllocations(employeeIds, to),
    ]);

  // Historical payslips keep their snapshot department/type even if the
  // employee record changed later.
  const payslips = allPayslips.filter(
    (slip) =>
      (!department || slip.department === department) &&
      (!employmentType || slip.employmentType === employmentType),
  );
  const paid = payslips.filter((slip) => slip.status === "paid");
  const netPaid = round(paid.reduce((sum, slip) => sum + slip.net, 0));

  const costs = new Map<string, { department: string; headcount: number; gross: number; net: number }>();
  const costRow = (name: string) => {
    const key = name || "Not assigned";
    const row = costs.get(key) ?? { department: key, headcount: 0, gross: 0, net: 0 };
    costs.set(key, row);

    return row;
  };

  for (const employee of employees) {
    costRow(employee.department).headcount++;
  }

  for (const slip of paid) {
    const row = costRow(slip.department);
    row.gross = round(row.gross + slip.gross);
    row.net = round(row.net + slip.net);
  }

  const trend = new Map<string, { month: string; net: number; gross: number; payslips: number }>();

  for (let month = shiftMonths(to.slice(0, 7), -11); month <= to.slice(0, 7); month = shiftMonths(month, 1)) {
    trend.set(month, { month, net: 0, gross: 0, payslips: 0 });
  }

  for (const row of trendRows) {
    if (department && row.department !== department) continue;
    if (employmentType && row.employmentType !== employmentType) continue;

    const bucket = trend.get(row.month);

    if (bucket) {
      bucket.net = round(bucket.net + row.net);
      bucket.gross = round(bucket.gross + row.gross);
      bucket.payslips += row.payslips;
    }
  }

  const payrollStatus = { draft: 0, computed: 0, validated: 0, paid: 0 };
  const runs = new Map<string, { id: string; name: string; status: string }>();

  for (const slip of payslips) {
    if (!runs.has(slip.payrunId)) {
      runs.set(slip.payrunId, { id: slip.payrunId, name: slip.payrunName, status: slip.payrunStatus });
    }
  }

  for (const run of runs.values()) {
    payrollStatus[run.status as keyof typeof payrollStatus]++;
  }

  // Attendance quality across the scheduled (Mon-Fri) days up to today.
  const attendanceEnd = to < today ? to : today;
  const scheduledPerEmployee = attendanceEnd >= from ? expectedWorkingDays(from, attendanceEnd) : 0;
  const scheduledDays = scheduledPerEmployee * employees.filter((employee) => employee.contractId).length;
  const presentKeys = new Set<string>();
  let late = 0;
  let absent = 0;
  let overtimeHours = 0;
  let missingCheckouts = 0;
  let manualEdits = 0;

  for (const row of attendanceRows) {
    if (row.status === "present") {
      presentKeys.add(`${row.employeeId}:${row.attendanceDate}`);
    }

    if (row.status === "absent") absent++;
    if (row.late) late++;
    if (row.hasCheckIn && !row.hasCheckOut && row.attendanceDate < today) missingCheckouts++;
    if (row.edited) manualEdits++;
    overtimeHours += row.overtimeHours;
  }

  // Approved full-day leave counts as covered so it does not read as absence.
  let approvedDays = 0;
  let approvedHours = 0;
  let unpaidDays = 0;
  let pendingRequests = 0;
  const leaveCovered = new Set<string>();

  for (const row of leaveRows) {
    if (!employeeIdSet.has(row.employeeId)) continue;

    if (row.status === "pending") {
      pendingRequests++;
      continue;
    }

    for (const charge of row.charges) {
      if (charge.date < from || charge.date > to) continue;

      if (row.unit === "days") {
        approvedDays += charge.amount;
        if (row.payroll === "unpaid") unpaidDays += charge.amount;
        if (charge.amount >= 1 && charge.date <= attendanceEnd) {
          leaveCovered.add(`${row.employeeId}:${charge.date}`);
        }
      } else {
        approvedHours += charge.amount;
        if (row.payroll === "unpaid") unpaidDays += charge.amount / HOURS_PER_DAY;
      }
    }
  }

  const coveredDays = new Set([...presentKeys, ...leaveCovered]).size;
  const coverage = scheduledDays ? Math.round((Math.min(coveredDays, scheduledDays) / scheduledDays) * 100) : null;

  const consumed = await findConsumedAllocations(allocations.map((item) => item.id), to);
  const remainingBalanceDays = round(
    allocations
      .filter((allocation) => allocation.unit === "days")
      .reduce(
        (sum, allocation) => sum + Math.max(0, allocation.amount - (consumed.get(allocation.id) ?? 0)),
        0,
      ),
  );

  const withoutContract = employees.filter((employee) => !employee.contractId).length;
  const expiringSoon = employees.filter(
    (employee) => employee.contractEndDate && employee.contractEndDate <= addDays(to, 30),
  ).length;
  const withoutStructure = employees.filter(
    (employee) => employee.contractId && !employee.salaryStructureId,
  ).length;

  const alerts: DashboardAlert[] = [];

  for (const run of runs.values()) {
    if (run.status === "draft" || run.status === "computed") {
      alerts.push({
        kind: "payrun",
        message: `${run.name} is ${run.status} and not yet validated.`,
        payrunId: run.id,
        payrunName: run.name,
      });
    }
  }

  for (const slip of payslips) {
    if (slip.status === "paid") continue;

    for (const warning of slip.warnings) {
      if (!warning.blocking) continue;

      alerts.push({
        kind: warning.code === "bank" ? "bank" : warning.code === "duplicate" ? "duplicate" : "warning",
        message: `${slip.employeeName}: ${warning.message}`,
        payrunId: slip.payrunId,
        payrunName: slip.payrunName,
        employeeId: slip.employeeId,
      });
    }
  }

  for (const employee of employees) {
    if (!employee.contractId) {
      alerts.push({
        kind: "contract",
        message: `${employee.name} has no contract covering this period.`,
        employeeId: employee.id,
      });
    } else if (!employee.salaryStructureId) {
      alerts.push({
        kind: "contract",
        message: `${employee.name}'s contract has no salary structure assigned.`,
        employeeId: employee.id,
      });
    } else if (employee.contractEndDate && employee.contractEndDate <= addDays(to, 30)) {
      alerts.push({
        kind: "contract",
        message: `${employee.name}'s contract ends on ${employee.contractEndDate}.`,
        employeeId: employee.id,
      });
    }
  }

  return {
    filters: { from, to, department, employmentType, departments },
    kpis: {
      netPaid,
      payslipsGenerated: payslips.length,
      averageNet: paid.length ? round(netPaid / paid.length) : 0,
      approvedLeaveDays: round(approvedDays),
      attendanceHealth: coverage,
      headcount: employees.length,
    },
    costByDepartment: [...costs.values()].sort((a, b) => b.net - a.net || a.department.localeCompare(b.department)),
    monthlyTrend: [...trend.values()],
    payrollStatus,
    attendance: {
      present: presentKeys.size,
      late,
      absent,
      overtimeHours: round(overtimeHours),
      missingCheckouts,
      manualEdits,
      scheduledDays,
      coveredDays,
      coverage,
    },
    timeOff: {
      approvedDays: round(approvedDays),
      approvedHours: round(approvedHours),
      unpaidDays: round(unpaidDays),
      pendingRequests,
      remainingBalanceDays,
    },
    contracts: { withoutContract, expiringSoon, withoutStructure },
    alerts: alerts.slice(0, 50),
  };
}
