import { getCached, setCached } from "../lib/cache";
import {
  DashboardScope,
  findAlertCounts,
  findAttendanceTotals,
  findDepartmentRows,
  findFilterOptions,
  findMonthlyTrend,
  findPayrunStatusCounts,
  findPayrunWarnings,
  findPayslipTotals,
  findTimeOffRows,
} from "../repositories/payroll-dashboard.repository";
import { PayrollDashboardQuery } from "../types/payroll.dto";
import {
  PayrollAlert,
  PayrollDashboard,
  PayrollStatus,
  PayrollTimeOffSummary,
} from "../types/payroll";
import { payrollListCacheKey } from "./payroll-cache";

const DAY_MS = 86_400_000;

function toDate(value: string): number {
  return Date.parse(`${value}T00:00:00Z`);
}

function toIsoDate(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * The period of the same length immediately before this one. Comparing against
 * "last month" would be wrong for any period that is not a calendar month, and
 * the dashboard lets the operator choose an arbitrary range.
 */
function previousPeriod(startDate: string, endDate: string): {
  startDate: string;
  endDate: string;
} {
  const start = toDate(startDate);
  const length = toDate(endDate) - start + DAY_MS;

  return {
    startDate: toIsoDate(start - length),
    endDate: toIsoDate(start - DAY_MS),
  };
}

function round(value: number, places = 2): number {
  const factor = 10 ** places;

  return Math.round(value * factor) / factor;
}

function emptyStatusCounts(): Record<PayrollStatus, number> {
  return { draft: 0, computed: 0, validated: 0, paid: 0 };
}

function alert(
  code: string,
  count: number,
  message: string,
  blocking: boolean,
): PayrollAlert | null {
  return count > 0 ? { code, message, count, blocking } : null;
}

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function summariseTimeOff(
  rows: Awaited<ReturnType<typeof findTimeOffRows>>,
): PayrollTimeOffSummary {
  const summary: PayrollTimeOffSummary = {
    approvedDays: 0,
    approvedHours: 0,
    unpaidDays: 0,
    unpaidHours: 0,
    pendingRequests: 0,
    remainingDays: 0,
    remainingHours: 0,
    types: rows,
  };

  for (const row of rows) {
    // Days and hours are never added together: a day is a schedule's worth of
    // work, and how many hours that is differs per employee.
    const days = row.unit === "days";

    if (days) {
      summary.approvedDays += row.approved;
      summary.remainingDays += row.remaining ?? 0;

      if (!row.paid) {
        summary.unpaidDays += row.approved;
      }
    } else {
      summary.approvedHours += row.approved;
      summary.remainingHours += row.remaining ?? 0;

      if (!row.paid) {
        summary.unpaidHours += row.approved;
      }
    }

    summary.pendingRequests += row.pendingRequests;
  }

  summary.approvedDays = round(summary.approvedDays);
  summary.approvedHours = round(summary.approvedHours);
  summary.unpaidDays = round(summary.unpaidDays);
  summary.unpaidHours = round(summary.unpaidHours);
  summary.remainingDays = round(summary.remainingDays);
  summary.remainingHours = round(summary.remainingHours);

  return summary;
}

/**
 * One period of payroll seen together with the HR data that explains it.
 *
 * Cached under the payroll namespace, so any payroll write invalidates it
 * immediately. A write in attendance, time off or contracts does not: those
 * figures can lag by the cache TTL, which is the trade this dashboard accepts
 * for reading five modules in one request.
 */
export async function getPayrollDashboard(
  query: PayrollDashboardQuery,
): Promise<PayrollDashboard> {
  const cacheKey = await payrollListCacheKey("dashboard", query);
  const cached = await getCached<PayrollDashboard>(cacheKey);

  if (cached) {
    return cached;
  }

  const scope: DashboardScope = {
    startDate: query.startDate,
    endDate: query.endDate,
    department: query.department ?? null,
    jobPosition: query.jobPosition ?? null,
    currency: query.currency,
  };
  const previous = previousPeriod(query.startDate, query.endDate);

  const [
    totals,
    previousTotals,
    departments,
    trends,
    attendance,
    timeOffRows,
    payrunStatuses,
    payrunWarnings,
    alertCounts,
    filters,
  ] = await Promise.all([
    findPayslipTotals(scope),
    findPayslipTotals({ ...scope, ...previous }),
    findDepartmentRows(scope),
    findMonthlyTrend(scope),
    findAttendanceTotals(scope),
    findTimeOffRows(scope),
    findPayrunStatusCounts(scope),
    findPayrunWarnings(scope),
    findAlertCounts(scope),
    findFilterOptions(),
  ]);

  const statusCounts = emptyStatusCounts();
  statusCounts.draft = totals.draft;
  statusCounts.computed = totals.computed;
  statusCounts.validated = totals.validated;
  statusCounts.paid = totals.paid;

  const payrunStatusCounts = emptyStatusCounts();

  for (const row of payrunStatuses) {
    payrunStatusCounts[row.status] = row.count;
  }

  const reviewed = attendance.present + attendance.absent + attendance.incomplete;

  const alerts = [
    alert(
      "missing_bank_account",
      alertCounts.missingBankAccounts,
      `${plural(alertCounts.missingBankAccounts, "employee")} in this period have no bank account on file`,
      true,
    ),
    alert(
      "duplicate_payslip",
      alertCounts.duplicatePayslips,
      `${plural(alertCounts.duplicatePayslips, "employee")} hold more than one payslip covering this period`,
      true,
    ),
    alert(
      "unvalidated_payrun",
      alertCounts.unvalidatedPayruns,
      `${plural(alertCounts.unvalidatedPayruns, "payrun")} overlapping this period are not validated yet`,
      false,
    ),
    alert(
      "expiring_contract",
      alertCounts.expiringContracts,
      `${plural(alertCounts.expiringContracts, "contract")} end inside this period`,
      false,
    ),
    alert(
      "missing_contract",
      alertCounts.employeesWithoutContract,
      `${plural(alertCounts.employeesWithoutContract, "employee")} have no single contract covering the whole period`,
      false,
    ),
  ].filter((entry): entry is PayrollAlert => entry !== null);

  const dashboard: PayrollDashboard = {
    period: {
      startDate: query.startDate,
      endDate: query.endDate,
      previousStartDate: previous.startDate,
      previousEndDate: previous.endDate,
    },
    currency: query.currency,
    filters,
    totals: {
      payslips: totals.payslips,
      netPaid: round(totals.netPaid),
      grossPaid: round(totals.grossPaid),
      deductionsPaid: round(totals.deductionsPaid),
      employeesPaid: totals.employeesPaid,
      statusCounts,
    },
    previous: {
      netPaid: round(previousTotals.netPaid),
      payslips: previousTotals.payslips,
    },
    // A period that paid nothing has no percentage to grow from, so the client
    // is told there is no comparison rather than being handed a 0% or an
    // infinity to render.
    netPaidChange:
      previousTotals.netPaid > 0
        ? round(
            ((totals.netPaid - previousTotals.netPaid) / previousTotals.netPaid) *
              100,
            1,
          )
        : null,
    averageNet: totals.paid > 0 ? round(totals.netPaid / totals.paid) : 0,
    headcount: departments.reduce((sum, row) => sum + row.headcount, 0),
    departments: departments.map((row) => ({
      ...row,
      net: round(row.net),
      gross: round(row.gross),
    })),
    trends: trends.map((point) => ({ ...point, net: round(point.net) })),
    attendance: {
      ...attendance,
      workedHours: round(attendance.workedHours),
      overtimeHours: round(attendance.overtimeHours),
      coverage: reviewed > 0 ? Math.round((attendance.present / reviewed) * 100) : null,
    },
    timeOff: summariseTimeOff(
      timeOffRows.map((row) => ({
        ...row,
        approved: round(row.approved),
        remaining: row.remaining === null ? null : round(row.remaining),
      })),
    ),
    payrunStatusCounts,
    warnings: payrunWarnings.flatMap((run) =>
      run.warnings.map((warning) => ({
        ...warning,
        payrunId: run.payrunId,
        payrunName: run.payrunName,
      })),
    ),
    alerts,
  };

  await setCached(cacheKey, dashboard);

  return dashboard;
}
