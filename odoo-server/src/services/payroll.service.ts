import { AppError } from "../errors/AppError";
import { getCached, setCached } from "../lib/cache";
import {
  expectedWork,
  periodDays,
  periodWage,
  round,
  runSalaryRules,
  validateRuleSequence,
} from "../lib/payroll-engine";
import {
  PayrollComputeInput,
  deletePayrunById,
  findAllPayruns,
  findEligibleEmployees,
  findPayrollComputeInputs,
  findPayrunById,
  insertPayrun,
  removePayrunEmployee,
  resetPayrunToDraft,
  updatePayrunById,
  updatePayrunStatus,
} from "../repositories/payrun.repository";
import {
  PayslipWrite,
  deletePayslipById,
  findAllPayslips,
  findPayslipById,
  replacePayrunPayslips,
  updatePayslipStatusByPayrun,
  upsertBankAccount,
} from "../repositories/payslip.repository";
import { findSalaryStructureById } from "../repositories/salary-structure.repository";
import { findRulesForStructure } from "../repositories/salary-rule.repository";
import {
  CreatePayrunInput,
  EligibleEmployeesQuery,
  ListPayrunsQuery,
  ListPayslipsQuery,
  UpdatePayrunInput,
} from "../types/payroll.dto";
import {
  ContractSnapshot,
  PayrollEmployeeOption,
  PayrollWarning,
  PayrunListResult,
  PayrunRecord,
  PayslipListResult,
  PayslipRecord,
  Pagination,
  SalaryRuleRecord,
  WAGE_PERIODS,
  WagePeriod,
} from "../types/payroll";
import { invalidatePayrollCaches, payrollListCacheKey } from "./payroll-cache";

/** Validated and paid payroll is history: it is never recalculated or edited. */
function isLocked(payrun: PayrunRecord): boolean {
  return payrun.status === "validated" || payrun.status === "paid";
}

function pagination(
  total: number,
  limit: number,
  offset: number,
  count: number,
): Pagination {
  return { total, limit, offset, hasMore: offset + count < total };
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { code?: string }).code;
}

function toDomainError(error: unknown): AppError | null {
  const code = getErrorCode(error);

  if (code === "23503") {
    return new AppError(404, "The salary structure or employee no longer exists");
  }

  if (code === "23514") {
    return new AppError(400, "Payrun violates a database constraint");
  }

  return null;
}

async function requirePayrun(id: string): Promise<PayrunRecord> {
  const payrun = await findPayrunById(id);

  if (!payrun) {
    throw new AppError(404, "Payrun not found");
  }

  return payrun;
}

/**
 * Only employees whose contract covers the whole period can be paid, so the
 * selection is checked against the same query the selection screen reads.
 */
async function assertEmployeesAreEligible(
  employeeIds: string[],
  startDate: string,
  endDate: string,
): Promise<void> {
  const unique = [...new Set(employeeIds)];

  if (unique.length !== employeeIds.length) {
    throw new AppError(400, "An employee was selected more than once");
  }

  const { rows } = await findEligibleEmployees({
    startDate,
    endDate,
    limit: 500,
    offset: 0,
  });

  const eligible = new Set(rows.map((employee) => employee.id));
  const rejected = unique.filter((id) => !eligible.has(id));

  if (rejected.length > 0) {
    throw new AppError(
      400,
      `${rejected.length} selected employee(s) have no running contract covering the full period`,
    );
  }
}

async function requireActiveStructure(
  structureId: string,
): Promise<{ id: string; name: string }> {
  const structure = await findSalaryStructureById(structureId);

  if (!structure) {
    throw new AppError(404, "Salary structure not found");
  }

  if (!structure.active) {
    throw new AppError(400, "Choose an active salary structure");
  }

  return { id: structure.id, name: structure.name };
}

export async function createPayrun(
  input: CreatePayrunInput,
  createdBy?: string,
): Promise<PayrunRecord> {
  await requireActiveStructure(input.structureId);
  await assertEmployeesAreEligible(
    input.employeeIds,
    input.startDate,
    input.endDate,
  );

  try {
    const payrun = await insertPayrun({ ...input, createdBy });

    await invalidatePayrollCaches();

    return payrun;
  } catch (error) {
    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function listPayruns(
  query: ListPayrunsQuery,
): Promise<PayrunListResult> {
  const cacheKey = await payrollListCacheKey("payruns", query);
  const cached = await getCached<PayrunListResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const { rows, total } = await findAllPayruns(query);

  const result: PayrunListResult = {
    payruns: rows,
    pagination: pagination(total, query.limit, query.offset, rows.length),
  };

  await setCached(cacheKey, result);

  return result;
}

export async function getPayrun(id: string): Promise<PayrunRecord> {
  return requirePayrun(id);
}

export async function updatePayrun(
  id: string,
  input: UpdatePayrunInput,
): Promise<PayrunRecord> {
  const existing = await requirePayrun(id);

  if (isLocked(existing)) {
    throw new AppError(409, "Only draft or computed payruns can be edited");
  }

  await requireActiveStructure(input.structureId);
  await assertEmployeesAreEligible(
    input.employeeIds,
    input.startDate,
    input.endDate,
  );

  try {
    const payrun = await updatePayrunById(id, input);

    if (!payrun) {
      throw new AppError(404, "Payrun not found");
    }

    await invalidatePayrollCaches();

    return payrun;
  } catch (error) {
    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function removePayrun(id: string): Promise<string> {
  const existing = await requirePayrun(id);

  if (isLocked(existing)) {
    throw new AppError(
      409,
      "Validated and paid payroll is preserved as history and cannot be deleted",
    );
  }

  const deletedId = await deletePayrunById(id);

  if (!deletedId) {
    throw new AppError(404, "Payrun not found");
  }

  await invalidatePayrollCaches();

  return deletedId;
}

/**
 * Builds one payslip from one employee's inputs. Every problem the operator has
 * to see -- a missing contract, a missing account, a duplicate payslip, a rule
 * that will not evaluate -- becomes a warning on the payslip rather than an
 * error that hides the rest of the batch.
 */
function computePayslip(
  input: PayrollComputeInput,
  payrun: PayrunRecord,
  structureRules: SalaryRuleRecord[],
): PayslipWrite {
  const warnings: PayrollWarning[] = [];
  const warn = (code: string, message: string, blocking = true): void => {
    warnings.push({ code, message, employeeId: input.employeeId, blocking });
  };

  const { expectedDays, expectedHours } = expectedWork(
    payrun.startDate,
    payrun.endDate,
  );

  const payslip: PayslipWrite = {
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    employeeEmail: input.employeeEmail,
    department: input.department || "Unassigned",
    jobPosition: input.jobPosition,
    structureId: payrun.structureId,
    structureName: payrun.structureName,
    startDate: payrun.startDate,
    endDate: payrun.endDate,
    status: "computed",
    currency: input.contractCurrency ?? "INR",
    workedDays: input.workedDays,
    workedHours: round(input.workedHours),
    expectedDays,
    expectedHours,
    basic: 0,
    allowances: 0,
    deductions: 0,
    contributions: 0,
    gross: 0,
    net: 0,
    bankAccount: input.bankAccount,
    contractSnapshot: null,
    lines: [],
    warnings,
  };

  if (input.employeeStatus !== "active") {
    warn("employee", "This employee account is inactive.");
  }

  if (!input.bankAccount.trim()) {
    warn(
      "bank",
      "Bank details are missing. Add a payment account before validation.",
    );
  }

  if (!input.employeeEmail) {
    warn("email", "Work email is missing; payslip delivery is unavailable.", false);
  }

  if (input.overlappingPayslips > 0) {
    warn("duplicate", "Another payslip already overlaps this payroll period.");
  }

  if (input.applicableContracts > 1) {
    warn(
      "contract",
      "More than one contract applies to this period. Split the payroll period.",
      false,
    );
  }

  if (
    !input.contractId ||
    input.contractWage === null ||
    input.contractStartDate === null ||
    input.contractEndDate === null
  ) {
    warn(
      "contract",
      "No contract covers the full payroll period for this employee.",
    );

    return payslip;
  }

  const contract: ContractSnapshot = {
    id: input.contractId,
    startDate: input.contractStartDate,
    endDate: input.contractEndDate,
    wage: input.contractWage,
    currency: input.contractCurrency ?? "INR",
    wagePeriod: WAGE_PERIODS.includes(input.contractWagePeriod as WagePeriod)
      ? (input.contractWagePeriod as WagePeriod)
      : "month",
    status: input.contractStatus ?? "running",
  };

  payslip.contractSnapshot = contract;
  payslip.currency = contract.currency;

  if (contract.status !== "running") {
    warn("contract", "The applicable contract is not running.", false);
  }

  if (input.openAttendances > 0) {
    warn(
      "attendance",
      "Attendance contains missing check-outs. Review worked hours.",
      contract.wagePeriod === "hour",
    );
  }

  const activeRules = structureRules.filter((rule) => rule.active);

  if (activeRules.length === 0) {
    warn("rules", "The salary structure has no active rules.");

    return payslip;
  }

  const rulesError = validateRuleSequence(activeRules);

  if (rulesError) {
    warn("rules", rulesError);

    return payslip;
  }

  const computation = runSalaryRules(
    activeRules,
    {
      WAGE: periodWage(
        contract,
        payrun.startDate,
        payrun.endDate,
        payslip.workedHours,
      ),
      WORKED_DAYS: payslip.workedDays,
      WORKED_HOURS: payslip.workedHours,
      OVERTIME_HOURS: round(input.overtimeHours),
      EXPECTED_DAYS: expectedDays,
      EXPECTED_HOURS: expectedHours,
      PERIOD_DAYS: periodDays(payrun.startDate, payrun.endDate),
      UNPAID_DAYS:
        contract.wagePeriod === "hour" ? 0 : round(input.unpaidLeaveDays),
    },
    warn,
  );

  payslip.lines = computation.lines;
  payslip.basic = computation.basic;
  payslip.allowances = computation.allowances;
  payslip.deductions = computation.deductions;
  payslip.contributions = computation.contributions;
  payslip.gross = computation.gross;
  payslip.net = computation.net;

  if (payslip.net < 0) {
    warn("negative", "Net salary is negative. Review the salary rules.");
  }

  return payslip;
}

export async function computePayrun(id: string): Promise<PayrunRecord> {
  const payrun = await requirePayrun(id);

  if (isLocked(payrun)) {
    throw new AppError(409, "Validated and paid payroll is immutable history");
  }

  if (payrun.employeeIds.length === 0) {
    throw new AppError(400, "Add at least one employee before computing");
  }

  const structure = await findSalaryStructureById(payrun.structureId);

  if (!structure) {
    throw new AppError(404, "Salary structure not found");
  }

  const rules = await findRulesForStructure(structure.id);
  const inputs = await findPayrollComputeInputs(
    id,
    payrun.startDate,
    payrun.endDate,
  );

  const payslips = inputs.map((input) => computePayslip(input, payrun, rules));

  await replacePayrunPayslips(id, payslips);

  const updated = await updatePayrunStatus(
    id,
    "computed",
    "computed_at",
    payslips.flatMap((payslip) => payslip.warnings),
  );

  await invalidatePayrollCaches();

  return updated ?? payrun;
}

export async function validatePayrun(id: string): Promise<PayrunRecord> {
  const payrun = await requirePayrun(id);

  if (payrun.status !== "computed") {
    throw new AppError(409, "Compute this payrun before validating it");
  }

  // Recompute first: inputs may have moved since the operator last looked, and
  // validation freezes whatever it approves.
  const recomputed = await computePayrun(id);

  if (recomputed.warnings.some((warning) => warning.blocking)) {
    throw new AppError(
      409,
      "Resolve the blocking payroll warnings, then compute and validate again",
    );
  }

  const updated = await updatePayrunStatus(id, "validated", "validated_at");

  await updatePayslipStatusByPayrun(id, "validated");
  await invalidatePayrollCaches();

  return updated ?? recomputed;
}

export async function markPayrunPaid(id: string): Promise<PayrunRecord> {
  const payrun = await requirePayrun(id);

  if (payrun.status !== "validated") {
    throw new AppError(409, "Validate this payrun before marking it paid");
  }

  const updated = await updatePayrunStatus(id, "paid", "paid_at");

  await updatePayslipStatusByPayrun(id, "paid");
  await invalidatePayrollCaches();

  return updated ?? payrun;
}

export async function listPayslips(
  query: ListPayslipsQuery,
): Promise<PayslipListResult> {
  const cacheKey = await payrollListCacheKey("payslips", query);
  const cached = await getCached<PayslipListResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const { rows, total } = await findAllPayslips(query);

  const result: PayslipListResult = {
    payslips: rows,
    pagination: pagination(total, query.limit, query.offset, rows.length),
  };

  await setCached(cacheKey, result);

  return result;
}

export async function getPayslip(id: string): Promise<PayslipRecord> {
  const payslip = await findPayslipById(id);

  if (!payslip) {
    throw new AppError(404, "Payslip not found");
  }

  return payslip;
}

/**
 * Deleting a payslip takes its employee out of the payrun -- otherwise the next
 * compute would simply recreate it.
 */
export async function removePayslip(id: string): Promise<string> {
  const payslip = await findPayslipById(id);

  if (!payslip) {
    throw new AppError(404, "Payslip not found");
  }

  const payrun = await requirePayrun(payslip.payrunId);

  if (isLocked(payrun)) {
    throw new AppError(409, "Only unvalidated payslips can be deleted");
  }

  if (payrun.employeeIds.length <= 1) {
    throw new AppError(409, "Delete the payrun to remove its last payslip");
  }

  await deletePayslipById(id);
  await removePayrunEmployee(payrun.id, payslip.employeeId);
  await resetPayrunToDraft(payrun.id);
  await invalidatePayrollCaches();

  return payrun.id;
}

/**
 * Not cached: eligibility follows the contracts and employee accounts, which
 * payroll writes never version.
 */
export async function listEligibleEmployees(
  query: EligibleEmployeesQuery,
): Promise<{ employees: PayrollEmployeeOption[]; pagination: Pagination }> {
  const { rows, total } = await findEligibleEmployees(query);

  return {
    employees: rows,
    pagination: pagination(total, query.limit, query.offset, rows.length),
  };
}

export async function setEmployeeBankAccount(
  employeeId: string,
  accountNumber: string,
): Promise<{ employeeId: string; accountNumber: string }> {
  try {
    const account = await upsertBankAccount(employeeId, accountNumber);

    await invalidatePayrollCaches();

    return account;
  } catch (error) {
    if (getErrorCode(error) === "23503") {
      throw new AppError(404, "Employee not found");
    }

    throw error;
  }
}
