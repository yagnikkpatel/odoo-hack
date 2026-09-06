import { pool } from "../lib/db";
import {
  PayrollAttendanceSummary,
  PayrollDepartmentRow,
  PayrollStatus,
  PayrollTimeOffRow,
  PayrollTrendPoint,
  PayrollWarning,
  UNASSIGNED_GROUP,
} from "../types/payroll";

/**
 * Every read below answers one dashboard panel with one aggregate query. The
 * alternative -- shipping the period's payslips, attendances and leave requests
 * to the client and folding them there -- is what this module replaces: a month
 * of payroll for a mid-sized company is tens of thousands of rows, and the
 * client only ever renders the totals.
 */

/** The dashboard's scope. `null` on a filter means "every value". */
export type DashboardScope = {
  startDate: string;
  endDate: string;
  department: string | null;
  jobPosition: string | null;
  currency: string;
};

/**
 * Payslips are filtered on their own snapshot columns rather than on today's
 * employee record: payroll history has to keep reporting under the department
 * and job position it was actually paid in.
 */
const PAYSLIP_SCOPE = `
  slip.start_date <= $2::date
  AND slip.end_date >= $1::date
  AND slip.currency = $5
  AND ($3::text IS NULL OR COALESCE(NULLIF(slip.department, ''), '${UNASSIGNED_GROUP}') = $3)
  AND ($4::text IS NULL OR COALESCE(NULLIF(slip.job_position, ''), '${UNASSIGNED_GROUP}') = $4)
`;

/** Expects `employee_profiles p` in scope, and the filters at $3 and $4. */
const EMPLOYEE_SCOPE = `
  ($3::text IS NULL OR COALESCE(NULLIF(p.department, ''), '${UNASSIGNED_GROUP}') = $3)
  AND ($4::text IS NULL OR COALESCE(NULLIF(p.job_position, ''), '${UNASSIGNED_GROUP}') = $4)
`;

/** The same predicate where the filters land at $1 and $2 instead. */
const EMPLOYEE_SCOPE_FIRST = `
  ($1::text IS NULL OR COALESCE(NULLIF(p.department, ''), '${UNASSIGNED_GROUP}') = $1)
  AND ($2::text IS NULL OR COALESCE(NULLIF(p.job_position, ''), '${UNASSIGNED_GROUP}') = $2)
`;

export type PayslipTotalsRow = {
  payslips: number;
  draft: number;
  computed: number;
  validated: number;
  paid: number;
  netPaid: number;
  grossPaid: number;
  deductionsPaid: number;
  employeesPaid: number;
};

/**
 * Amounts count paid payslips only -- a computed payslip is a calculation, not
 * a payment -- while the counts cover every status so the status split and the
 * "payslips generated" figure come from the same pass.
 */
export async function findPayslipTotals(
  scope: DashboardScope,
): Promise<PayslipTotalsRow> {
  const result = await pool.query<PayslipTotalsRow>(
    `SELECT
       COUNT(*)::int AS "payslips",
       COUNT(*) FILTER (WHERE slip.status = 'draft')::int AS "draft",
       COUNT(*) FILTER (WHERE slip.status = 'computed')::int AS "computed",
       COUNT(*) FILTER (WHERE slip.status = 'validated')::int AS "validated",
       COUNT(*) FILTER (WHERE slip.status = 'paid')::int AS "paid",
       COALESCE(SUM(slip.net) FILTER (WHERE slip.status = 'paid'), 0)::float8
         AS "netPaid",
       COALESCE(SUM(slip.gross) FILTER (WHERE slip.status = 'paid'), 0)::float8
         AS "grossPaid",
       COALESCE(
         SUM(slip.deductions + slip.contributions)
           FILTER (WHERE slip.status = 'paid'),
         0
       )::float8 AS "deductionsPaid",
       COUNT(DISTINCT slip.employee_id)
         FILTER (WHERE slip.status = 'paid')::int AS "employeesPaid"
     FROM payslips slip
     WHERE ${PAYSLIP_SCOPE}`,
    [
      scope.startDate,
      scope.endDate,
      scope.department,
      scope.jobPosition,
      scope.currency,
    ],
  );

  return result.rows[0];
}

/**
 * Headcount and salary cost are two different populations -- an employee with
 * no payslip still counts, a payslip whose employee has left still costs -- so
 * they are aggregated separately and joined on the department name.
 */
export async function findDepartmentRows(
  scope: DashboardScope,
): Promise<PayrollDepartmentRow[]> {
  const result = await pool.query<PayrollDepartmentRow>(
    `WITH headcount AS (
       SELECT
         COALESCE(NULLIF(p.department, ''), '${UNASSIGNED_GROUP}') AS department,
         COUNT(*)::int AS headcount
       FROM users u
       LEFT JOIN employee_profiles p ON p.user_id = u.id
       WHERE u.status = 'active' AND ${EMPLOYEE_SCOPE}
       GROUP BY 1
     ),
     cost AS (
       SELECT
         COALESCE(NULLIF(slip.department, ''), '${UNASSIGNED_GROUP}') AS department,
         COUNT(*)::int AS payslips,
         COALESCE(SUM(slip.net) FILTER (WHERE slip.status = 'paid'), 0)::float8
           AS net,
         COALESCE(SUM(slip.gross) FILTER (WHERE slip.status = 'paid'), 0)::float8
           AS gross
       FROM payslips slip
       WHERE ${PAYSLIP_SCOPE}
       GROUP BY 1
     )
     SELECT
       COALESCE(headcount.department, cost.department) AS "department",
       COALESCE(headcount.headcount, 0) AS "headcount",
       COALESCE(cost.payslips, 0) AS "payslips",
       COALESCE(cost.net, 0)::float8 AS "net",
       COALESCE(cost.gross, 0)::float8 AS "gross"
     FROM headcount
     FULL OUTER JOIN cost ON cost.department = headcount.department
     ORDER BY "net" DESC, "department" ASC`,
    [
      scope.startDate,
      scope.endDate,
      scope.department,
      scope.jobPosition,
      scope.currency,
    ],
  );

  return result.rows;
}

/**
 * The trend is deliberately not clipped to the selected period: a single month
 * plots as one point, so it runs over the twelve months ending with the
 * period's month and keeps the department, position and currency filters.
 */
export async function findMonthlyTrend(
  scope: DashboardScope,
): Promise<PayrollTrendPoint[]> {
  const result = await pool.query<PayrollTrendPoint>(
    `SELECT
       to_char(slip.end_date, 'YYYY-MM') AS "month",
       COALESCE(SUM(slip.net), 0)::float8 AS "net",
       COUNT(*)::int AS "payslips"
     FROM payslips slip
     WHERE slip.status = 'paid'
       AND slip.currency = $4
       AND slip.end_date >= (date_trunc('month', $1::date) - INTERVAL '11 months')::date
       AND slip.end_date < (date_trunc('month', $1::date) + INTERVAL '1 month')::date
       AND ($2::text IS NULL OR COALESCE(NULLIF(slip.department, ''), '${UNASSIGNED_GROUP}') = $2)
       AND ($3::text IS NULL OR COALESCE(NULLIF(slip.job_position, ''), '${UNASSIGNED_GROUP}') = $3)
     GROUP BY 1
     ORDER BY 1`,
    [scope.endDate, scope.department, scope.jobPosition, scope.currency],
  );

  return result.rows;
}

export type AttendanceTotalsRow = Omit<PayrollAttendanceSummary, "coverage">;

/**
 * Attendance is a property of the employee, not of the payslip, so it follows
 * today's employee record. Inactive employees are included: their attendance
 * still happened inside the period being reported on.
 */
export async function findAttendanceTotals(
  scope: DashboardScope,
): Promise<AttendanceTotalsRow> {
  const result = await pool.query<AttendanceTotalsRow>(
    `SELECT
       COUNT(*)::int AS "records",
       COUNT(DISTINCT a.employee_id)::int AS "employees",
       COUNT(*) FILTER (WHERE a.status = 'present')::int AS "present",
       COUNT(*) FILTER (WHERE a.status = 'absent')::int AS "absent",
       COUNT(*) FILTER (WHERE a.status = 'incomplete')::int AS "incomplete",
       COUNT(*) FILTER (
         WHERE a.check_in IS NOT NULL AND a.check_out IS NULL
       )::int AS "missingCheckOuts",
       COUNT(*) FILTER (WHERE a.edited_at IS NOT NULL)::int AS "manualEdits",
       COALESCE(SUM(a.worked_hours), 0)::float8 AS "workedHours",
       COALESCE(SUM(a.overtime_hours), 0)::float8 AS "overtimeHours"
     FROM attendances a
     JOIN users u ON u.id = a.employee_id
     LEFT JOIN employee_profiles p ON p.user_id = u.id
     WHERE a.attendance_date BETWEEN $1::date AND $2::date
       AND ${EMPLOYEE_SCOPE}`,
    [scope.startDate, scope.endDate, scope.department, scope.jobPosition],
  );

  return result.rows[0];
}

/**
 * One row per leave type: what was charged inside the period, what is still
 * waiting for approval, and the balance left at period end.
 *
 * The balance follows the same rule the time off module applies -- approved
 * allocations valid at period end, less the consumptions approved requests
 * booked against those allocations -- so the two screens cannot disagree.
 */
export async function findTimeOffRows(
  scope: DashboardScope,
): Promise<PayrollTimeOffRow[]> {
  const result = await pool.query<PayrollTimeOffRow>(
    `WITH scoped_employees AS (
       SELECT u.id
       FROM users u
       LEFT JOIN employee_profiles p ON p.user_id = u.id
       WHERE ${EMPLOYEE_SCOPE_FIRST}
     ),
     valid_allocations AS (
       SELECT alloc.id, alloc.type_id, alloc.amount
       FROM time_off_allocations alloc
       JOIN scoped_employees ON scoped_employees.id = alloc.employee_id
       WHERE alloc.status = 'approved'
         AND alloc.valid_from <= $4::date
         AND (alloc.valid_to IS NULL OR alloc.valid_to >= $4::date)
     ),
     allocated AS (
       SELECT type_id, SUM(amount) AS amount
       FROM valid_allocations
       GROUP BY type_id
     ),
     consumed AS (
       SELECT valid_allocations.type_id, SUM((entry->>'amount')::numeric) AS amount
       FROM time_off_requests req
       JOIN scoped_employees ON scoped_employees.id = req.employee_id
       CROSS JOIN LATERAL jsonb_array_elements(req.consumptions) AS entry
       JOIN valid_allocations
         ON valid_allocations.id = (entry->>'allocationId')::uuid
       WHERE req.status = 'approved'
         AND (entry->>'date')::date <= $4::date
       GROUP BY 1
     ),
     charged AS (
       SELECT req.type_id, SUM((charge->>'amount')::numeric) AS amount
       FROM time_off_requests req
       JOIN scoped_employees ON scoped_employees.id = req.employee_id
       CROSS JOIN LATERAL jsonb_array_elements(req.charges) AS charge
       WHERE req.status = 'approved'
         AND (charge->>'date')::date BETWEEN $3::date AND $4::date
       GROUP BY 1
     ),
     pending AS (
       SELECT req.type_id, COUNT(*)::int AS requests
       FROM time_off_requests req
       JOIN scoped_employees ON scoped_employees.id = req.employee_id
       WHERE req.status = 'pending'
         AND req.start_date <= $4::date
         AND req.end_date >= $3::date
       GROUP BY 1
     )
     SELECT
       t.id AS "typeId",
       t.name AS "name",
       t.unit AS "unit",
       (t.payroll = 'paid') AS "paid",
       COALESCE(charged.amount, 0)::float8 AS "approved",
       COALESCE(pending.requests, 0) AS "pendingRequests",
       CASE
         WHEN t.requires_allocation
           THEN (COALESCE(allocated.amount, 0) - COALESCE(consumed.amount, 0))::float8
         ELSE NULL
       END AS "remaining"
     FROM time_off_types t
     LEFT JOIN charged ON charged.type_id = t.id
     LEFT JOIN pending ON pending.type_id = t.id
     LEFT JOIN allocated ON allocated.type_id = t.id
     LEFT JOIN consumed ON consumed.type_id = t.id
     -- An archived type still shows while it holds activity in the period.
     WHERE t.active
        OR charged.amount IS NOT NULL
        OR pending.requests IS NOT NULL
     ORDER BY t.name ASC`,
    [scope.department, scope.jobPosition, scope.startDate, scope.endDate],
  );

  return result.rows;
}

/**
 * Payruns are not filtered by department or currency: a payrun spans whichever
 * employees were selected for it, so narrowing it by one employee attribute
 * would report a run as missing rather than as partly in scope.
 */
export async function findPayrunStatusCounts(
  scope: DashboardScope,
): Promise<{ status: PayrollStatus; count: number }[]> {
  const result = await pool.query<{ status: PayrollStatus; count: number }>(
    `SELECT run.status AS "status", COUNT(*)::int AS "count"
     FROM payruns run
     WHERE run.start_date <= $2::date AND run.end_date >= $1::date
     GROUP BY 1`,
    [scope.startDate, scope.endDate],
  );

  return result.rows;
}

export type PayrunWarningRow = {
  payrunId: string;
  payrunName: string;
  warnings: PayrollWarning[];
};

/** The warnings compute recorded, capped: this panel is a prompt, not a log. */
export async function findPayrunWarnings(
  scope: DashboardScope,
): Promise<PayrunWarningRow[]> {
  const result = await pool.query<PayrunWarningRow>(
    `SELECT run.id AS "payrunId", run.name AS "payrunName", run.warnings AS "warnings"
     FROM payruns run
     WHERE run.start_date <= $2::date
       AND run.end_date >= $1::date
       AND jsonb_array_length(run.warnings) > 0
     ORDER BY run.start_date DESC, run.name ASC
     LIMIT 25`,
    [scope.startDate, scope.endDate],
  );

  return result.rows;
}

export type AlertCountsRow = {
  missingBankAccounts: number;
  duplicatePayslips: number;
  unvalidatedPayruns: number;
  expiringContracts: number;
  employeesWithoutContract: number;
};

/**
 * The five conditions that stop payroll from being paid, counted in one pass
 * because each is a single number and the panel shows them together.
 */
export async function findAlertCounts(
  scope: DashboardScope,
): Promise<AlertCountsRow> {
  const result = await pool.query<AlertCountsRow>(
    `SELECT
       (
         SELECT COUNT(DISTINCT slip.employee_id)::int
         FROM payslips slip
         WHERE ${PAYSLIP_SCOPE} AND slip.bank_account = ''
       ) AS "missingBankAccounts",
       (
         SELECT COUNT(*)::int
         FROM (
           SELECT slip.employee_id
           FROM payslips slip
           WHERE ${PAYSLIP_SCOPE}
           GROUP BY slip.employee_id
           HAVING COUNT(*) > 1
         ) duplicates
       ) AS "duplicatePayslips",
       (
         SELECT COUNT(*)::int
         FROM payruns run
         WHERE run.start_date <= $2::date
           AND run.end_date >= $1::date
           AND run.status IN ('draft', 'computed')
       ) AS "unvalidatedPayruns",
       (
         SELECT COUNT(*)::int
         FROM contracts c
         JOIN users u ON u.id = c.employee_id
         LEFT JOIN employee_profiles p ON p.user_id = u.id
         WHERE c.status = 'running'
           AND c.end_date BETWEEN $1::date AND $2::date
           AND ${EMPLOYEE_SCOPE}
       ) AS "expiringContracts",
       (
         -- Payroll needs one contract covering the whole period; an employee
         -- without one cannot be put into a payrun at all.
         SELECT COUNT(*)::int
         FROM users u
         LEFT JOIN employee_profiles p ON p.user_id = u.id
         WHERE u.status = 'active'
           AND ${EMPLOYEE_SCOPE}
           AND NOT EXISTS (
             SELECT 1
             FROM contracts c
             WHERE c.employee_id = u.id
               AND c.start_date <= $1::date
               AND c.end_date >= $2::date
           )
       ) AS "employeesWithoutContract"`,
    [
      scope.startDate,
      scope.endDate,
      scope.department,
      scope.jobPosition,
      scope.currency,
    ],
  );

  return result.rows[0];
}

export type DashboardFilterOptions = {
  departments: string[];
  jobPositions: string[];
  currencies: string[];
};

/**
 * Filter options come from employees and payslips together: a department that
 * only exists on historical payslips still has to be selectable, otherwise the
 * payroll it holds becomes unreachable.
 */
export async function findFilterOptions(): Promise<DashboardFilterOptions> {
  const result = await pool.query<DashboardFilterOptions>(
    `WITH departments AS (
       SELECT COALESCE(NULLIF(p.department, ''), '${UNASSIGNED_GROUP}') AS value
       FROM employee_profiles p
       UNION
       SELECT COALESCE(NULLIF(slip.department, ''), '${UNASSIGNED_GROUP}')
       FROM payslips slip
     ),
     positions AS (
       SELECT COALESCE(NULLIF(p.job_position, ''), '${UNASSIGNED_GROUP}') AS value
       FROM employee_profiles p
       UNION
       SELECT COALESCE(NULLIF(slip.job_position, ''), '${UNASSIGNED_GROUP}')
       FROM payslips slip
     ),
     currencies AS (
       SELECT slip.currency AS value FROM payslips slip
       UNION
       SELECT c.currency FROM contracts c
     )
     SELECT
       ARRAY(SELECT value FROM departments ORDER BY value) AS "departments",
       ARRAY(SELECT value FROM positions ORDER BY value) AS "jobPositions",
       ARRAY(SELECT value FROM currencies ORDER BY value) AS "currencies"`,
  );

  return result.rows[0];
}

