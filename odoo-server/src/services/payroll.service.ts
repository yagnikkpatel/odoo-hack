import { AppError } from "../errors/AppError";
import { logger } from "../lib/logger";
import { mailTransport, sendMail } from "../lib/mailer";
import {
  computePayslip,
  EngineRule,
  evaluateFormula,
  FORMULA_VARIABLES,
  periodDays,
  selectPeriodContract,
  validateRules,
} from "../lib/payroll-engine";
import { payslipFilename, renderPayslipPdf } from "../lib/payslip-pdf";
import {
  countStructureReferences,
  deletePayrunById,
  deletePayslipById,
  deleteRuleById,
  deleteStructureById,
  findAllPayruns,
  findAllPayslips,
  findAllRules,
  findAllStructures,
  findBankDetails,
  findEligibleEmployees,
  findEngineAttendance,
  findEngineBankDetails,
  findEngineContracts,
  findEngineEmployees,
  findEngineUnpaidLeave,
  findOverlappingPayslips,
  findPayrunById,
  findPayslipById,
  findPayslipsByPayrun,
  findRuleById,
  findRulesForStructure,
  findStructureById,
  insertPayrunWithPayslips,
  insertRule,
  insertStructure,
  markPayslipsSent,
  updatePayrunStatus,
  updatePayslipsStatus,
  updateRuleById,
  updateStructureById,
  upsertBankDetails,
  withTransaction,
  writePayslipComputation,
} from "../repositories/payroll.repository";
import {
  BankDetailsInput,
  CreatePayrunInput,
  CreateRuleInput,
  CreateStructureInput,
  ListPayrunsQuery,
  ListPayslipsQuery,
  PeriodQuery,
  SendPayslipsInput,
  UpdateRuleInput,
  UpdateStructureInput,
} from "../types/payroll.dto";
import {
  BankDetailsRecord,
  EligibleEmployee,
  PayrollSnapshot,
  PayrunDetail,
  PayrunRecord,
  PayslipRecord,
  SalaryRuleRecord,
  SalaryStructureRecord,
  SendPayslipsResult,
} from "../types/payroll";

export { getPayrollDashboard } from "./payroll-dashboard.service";

const MAX_PERIOD_DAYS = 366;

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { code?: string }).code;
}

function getErrorConstraint(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { constraint?: string }).constraint;
}

function toDomainError(error: unknown): AppError | null {
  const code = getErrorCode(error);
  const constraint = getErrorConstraint(error);

  if (code === "23503") {
    if (constraint === "salary_structure_rules_rule_id_fkey") {
      return new AppError(409, "This rule is used by a salary structure. Remove it from the structure first.");
    }

    if (constraint === "payruns_structure_id_fkey") {
      return new AppError(409, "This structure is used by a payrun. Archive it by switching Active off.");
    }

    return new AppError(404, "Referenced record not found");
  }

  if (code === "23505") {
    if (constraint === "salary_rules_code_unique_idx") {
      return new AppError(409, "A salary rule already uses this code");
    }

    if (constraint === "salary_structures_name_unique_idx") {
      return new AppError(409, "A salary structure already uses this name");
    }

    if (constraint === "payslips_payrun_employee_unique") {
      return new AppError(409, "An employee can appear only once in a payrun");
    }

    return new AppError(409, "A record with the same key already exists");
  }

  if (code === "23514") {
    return new AppError(400, "Payroll record violates a database constraint");
  }

  return null;
}

function rethrow(error: unknown): never {
  if (error instanceof AppError) {
    throw error;
  }

  const domainError = toDomainError(error);

  if (domainError) {
    throw domainError;
  }

  throw error;
}

function toEngineRule(rule: SalaryRuleRecord): EngineRule {
  return {
    id: rule.id,
    name: rule.name,
    code: rule.code,
    category: rule.category,
    sequence: rule.sequence,
    method: rule.method,
    amount: rule.amount,
    percentage: rule.percentage,
    base: rule.base,
    formula: rule.formula,
    active: rule.active,
  };
}

function assertPeriod(startDate: string, endDate: string): void {
  if (endDate < startDate) {
    throw new AppError(400, "The period end must be on or after its start");
  }

  if (periodDays(startDate, endDate) > MAX_PERIOD_DAYS) {
    throw new AppError(400, "Payroll periods cannot exceed one year");
  }
}

function isLocked(status: string): boolean {
  return status === "validated" || status === "paid";
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export async function getPayrollSnapshot(): Promise<PayrollSnapshot> {
  const [rules, structures, payruns, payslips] = await Promise.all([
    findAllRules(),
    findAllStructures(),
    findAllPayruns({}),
    findAllPayslips({}),
  ]);

  return { rules, structures, payruns, payslips };
}

// ---------------------------------------------------------------------------
// Salary rules
// ---------------------------------------------------------------------------

function assertRuleShape(rule: {
  code: string;
  method: string;
  base: string;
  formula: string;
}): void {
  if ((FORMULA_VARIABLES as readonly string[]).includes(rule.code)) {
    throw new AppError(400, `${rule.code} is a reserved payroll input and cannot be a rule code`);
  }

  if (rule.method === "percentage" && !rule.base.trim()) {
    throw new AppError(400, "Percentage rules need a base, such as BASIC or WAGE");
  }

  if (rule.method === "formula" && !rule.formula.trim()) {
    throw new AppError(400, "Formula rules need a formula");
  }
}

/** Every structure that includes the rule must still evaluate after the change. */
async function assertStructuresStillValid(
  changed: SalaryRuleRecord,
): Promise<void> {
  const structures = await findAllStructures();

  for (const structure of structures.filter((item) => item.ruleIds.includes(changed.id))) {
    const rules = (await findRulesForStructure(structure.id)).map((rule) =>
      rule.id === changed.id ? changed : rule,
    );
    const error = validateRules(rules.filter((rule) => rule.active).map(toEngineRule));

    if (error) {
      throw new AppError(400, `${structure.name}: ${error}`);
    }
  }
}

export function listRules(): Promise<SalaryRuleRecord[]> {
  return findAllRules();
}

export async function getRule(id: string): Promise<SalaryRuleRecord> {
  const rule = await findRuleById(id);

  if (!rule) {
    throw new AppError(404, "Salary rule not found");
  }

  return rule;
}

/**
 * A rule may reference any active rule with a lower sequence; whether those
 * rules are actually included in a structure is checked when the structure is
 * saved and again at compute time.
 */
async function assertRuleEvaluable(rule: {
  id?: string;
  name: string;
  code: string;
  sequence: number;
  method: string;
  base: string;
  formula: string;
}): Promise<void> {
  const context: Record<string, number> = Object.fromEntries(
    FORMULA_VARIABLES.map((code) => [code, 1]),
  );

  for (const other of await findAllRules()) {
    if (other.id !== rule.id && other.active && other.sequence < rule.sequence) {
      context[other.code] = 1;
    }
  }

  try {
    if (rule.method === "percentage") {
      evaluateFormula(rule.base, context);
    } else if (rule.method === "formula") {
      evaluateFormula(rule.formula, context);
    }
  } catch (error) {
    throw new AppError(
      400,
      `${rule.name}: ${(error as Error).message} Only inputs and active rules with a lower sequence can be referenced.`,
    );
  }
}

export async function createRule(input: CreateRuleInput): Promise<SalaryRuleRecord> {
  assertRuleShape(input);
  await assertRuleEvaluable(input);

  try {
    return await insertRule(input);
  } catch (caught) {
    return rethrow(caught);
  }
}

export async function updateRule(
  id: string,
  input: UpdateRuleInput,
): Promise<SalaryRuleRecord> {
  const existing = await getRule(id);
  const merged = { ...existing, ...input };
  assertRuleShape(merged);
  await assertRuleEvaluable(merged);
  await assertStructuresStillValid(merged);

  try {
    const rule = await updateRuleById(id, input);

    if (!rule) {
      throw new AppError(404, "Salary rule not found");
    }

    return rule;
  } catch (caught) {
    return rethrow(caught);
  }
}

export async function removeRule(id: string): Promise<string> {
  const rule = await getRule(id);

  if (rule.structureCount > 0) {
    throw new AppError(409, "Remove this rule from its salary structures first");
  }

  try {
    const deletedId = await deleteRuleById(id);

    if (!deletedId) {
      throw new AppError(404, "Salary rule not found");
    }

    return deletedId;
  } catch (caught) {
    return rethrow(caught);
  }
}

// ---------------------------------------------------------------------------
// Salary structures
// ---------------------------------------------------------------------------

async function assertStructureRules(
  ruleIds: string[],
  sequences: { ruleId: string; sequence: number }[],
): Promise<void> {
  const all = await findAllRules();
  const byId = new Map(all.map((rule) => [rule.id, rule]));

  for (const ruleId of ruleIds) {
    if (!byId.has(ruleId)) {
      throw new AppError(400, "Choose existing salary rules");
    }
  }

  for (const item of sequences) {
    if (!byId.has(item.ruleId)) {
      throw new AppError(400, "Sequence overrides must reference existing rules");
    }
  }

  const overrides = new Map(sequences.map((item) => [item.ruleId, item.sequence]));
  const selected = ruleIds
    .map((ruleId) => byId.get(ruleId) as SalaryRuleRecord)
    .map((rule) => ({ ...toEngineRule(rule), sequence: overrides.get(rule.id) ?? rule.sequence }))
    .filter((rule) => rule.active);
  const error = validateRules(selected);

  if (error) {
    throw new AppError(400, error);
  }
}

export function listStructures(): Promise<SalaryStructureRecord[]> {
  return findAllStructures();
}

export async function getStructure(id: string): Promise<SalaryStructureRecord> {
  const structure = await findStructureById(id);

  if (!structure) {
    throw new AppError(404, "Salary structure not found");
  }

  return structure;
}

export async function createStructure(
  input: CreateStructureInput,
): Promise<SalaryStructureRecord> {
  const ruleIds = [...new Set(input.ruleIds)];
  await assertStructureRules(ruleIds, input.sequences);

  try {
    return await insertStructure({ ...input, ruleIds });
  } catch (caught) {
    return rethrow(caught);
  }
}

export async function updateStructure(
  id: string,
  input: UpdateStructureInput,
): Promise<SalaryStructureRecord> {
  const existing = await getStructure(id);
  const ruleIds = [...new Set(input.ruleIds ?? existing.ruleIds)];
  await assertStructureRules(ruleIds, input.sequences ?? []);

  try {
    const structure = await updateStructureById(id, { ...input, ruleIds });

    if (!structure) {
      throw new AppError(404, "Salary structure not found");
    }

    return structure;
  } catch (caught) {
    return rethrow(caught);
  }
}

export async function removeStructure(id: string): Promise<string> {
  await getStructure(id);
  const references = await countStructureReferences(id);

  if (references.contracts > 0 || references.payruns > 0) {
    throw new AppError(
      409,
      "This structure is referenced by a contract or payrun. Archive it by switching Active off.",
    );
  }

  try {
    const deletedId = await deleteStructureById(id);

    if (!deletedId) {
      throw new AppError(404, "Salary structure not found");
    }

    return deletedId;
  } catch (caught) {
    return rethrow(caught);
  }
}

// ---------------------------------------------------------------------------
// Payruns
// ---------------------------------------------------------------------------

export function listPayruns(query: ListPayrunsQuery): Promise<PayrunRecord[]> {
  return findAllPayruns(query);
}

export async function getPayrun(id: string): Promise<PayrunDetail> {
  const payrun = await findPayrunById(id);

  if (!payrun) {
    throw new AppError(404, "Payrun not found");
  }

  const payslips = await findPayslipsByPayrun(id);

  return { payrun, payslips };
}

export async function listEligibleEmployees(
  query: PeriodQuery,
): Promise<EligibleEmployee[]> {
  assertPeriod(query.startDate, query.endDate);
  await getStructure(query.structureId);

  return findEligibleEmployees(query.structureId, query.startDate, query.endDate);
}

export async function createPayrun(
  input: CreatePayrunInput,
  actorId: string,
): Promise<PayrunRecord> {
  assertPeriod(input.startDate, input.endDate);
  const structure = await getStructure(input.structureId);

  if (!structure.active) {
    throw new AppError(400, "Choose an active salary structure");
  }

  if (structure.ruleCount === 0) {
    throw new AppError(400, "The salary structure has no rules yet");
  }

  const eligible = await findEligibleEmployees(
    input.structureId,
    input.startDate,
    input.endDate,
  );
  const byId = new Map(eligible.map((employee) => [employee.employeeId, employee]));
  const selected: EligibleEmployee[] = [];

  for (const employeeId of input.employeeIds) {
    const employee = byId.get(employeeId);

    if (!employee) {
      throw new AppError(
        400,
        "Every selected employee needs a single contract covering the full period. Refresh the employee selection.",
      );
    }

    selected.push(employee);
  }

  try {
    return await insertPayrunWithPayslips({
      name: input.name,
      structureId: structure.id,
      structureName: structure.name,
      startDate: input.startDate,
      endDate: input.endDate,
      createdBy: actorId,
      employees: selected,
    });
  } catch (caught) {
    return rethrow(caught);
  }
}

async function requireEditablePayrun(id: string): Promise<PayrunRecord> {
  const payrun = await findPayrunById(id);

  if (!payrun) {
    throw new AppError(404, "Payrun not found");
  }

  if (isLocked(payrun.status)) {
    throw new AppError(409, "Validated and paid payroll is preserved as immutable history");
  }

  return payrun;
}

/** Recomputes every payslip of the payrun from live records inside one transaction. */
async function recompute(payrun: PayrunRecord): Promise<PayslipRecord[]> {
  const structureRules = (await findRulesForStructure(payrun.structureId)).map(toEngineRule);

  return withTransaction(async (client) => {
    const payslips = await findPayslipsByPayrun(payrun.id, client);
    const ids = payslips.map((slip) => slip.employeeId);
    const [employees, contracts, attendance, unpaidLeave, bank, overlapping] =
      await Promise.all([
        findEngineEmployees(ids, client),
        findEngineContracts(ids, client),
        findEngineAttendance(ids, payrun.startDate, payrun.endDate, client),
        findEngineUnpaidLeave(ids, payrun.startDate, payrun.endDate, client),
        findEngineBankDetails(ids, client),
        findOverlappingPayslips(ids, payrun.startDate, payrun.endDate, client),
      ]);

    for (const slip of payslips) {
      const computed = computePayslip({
        payrunId: payrun.id,
        structureId: payrun.structureId,
        startDate: payrun.startDate,
        endDate: payrun.endDate,
        employeeId: slip.employeeId,
        employee: employees.find((item) => item.id === slip.employeeId) ?? null,
        contracts,
        rules: structureRules,
        attendance,
        unpaidLeave,
        bank: bank.find((item) => item.employeeId === slip.employeeId) ?? null,
        overlapping,
      });

      await writePayslipComputation(client, slip.id, "computed", computed);
    }

    await updatePayrunStatus(payrun.id, "computed", { computed_at: "now" }, client);

    return findPayslipsByPayrun(payrun.id, client);
  });
}

export async function computePayrun(id: string): Promise<PayrunDetail> {
  const payrun = await requireEditablePayrun(id);

  if (payrun.payslipCount === 0) {
    throw new AppError(409, "This payrun has no payslips left to compute");
  }

  try {
    await recompute(payrun);
  } catch (caught) {
    rethrow(caught);
  }

  return getPayrun(id);
}

export async function validatePayrun(id: string): Promise<PayrunDetail> {
  const payrun = await requireEditablePayrun(id);

  if (payrun.status !== "computed") {
    throw new AppError(409, "Compute this payrun before validating it");
  }

  // Inputs may have changed since the last compute, so validation always
  // recomputes and then checks the fresh warnings.
  let payslips: PayslipRecord[];

  try {
    payslips = await recompute(payrun);
  } catch (caught) {
    return rethrow(caught);
  }

  const blocking = payslips.flatMap((slip) =>
    slip.warnings.filter((warning) => warning.blocking),
  );

  if (blocking.length > 0) {
    throw new AppError(
      409,
      `Resolve ${blocking.length} blocking warning${blocking.length === 1 ? "" : "s"} before validating. The computation has been refreshed.`,
    );
  }

  await withTransaction(async (client) => {
    await updatePayslipsStatus(id, "validated", client);
    await updatePayrunStatus(id, "validated", { validated_at: "now" }, client);
  });

  return getPayrun(id);
}

export async function markPayrunPaid(id: string): Promise<PayrunDetail> {
  const payrun = await findPayrunById(id);

  if (!payrun) {
    throw new AppError(404, "Payrun not found");
  }

  if (payrun.status !== "validated") {
    throw new AppError(409, "Validate this payrun before marking it paid");
  }

  await withTransaction(async (client) => {
    await updatePayslipsStatus(id, "paid", client);
    await updatePayrunStatus(id, "paid", { paid_at: "now" }, client);
  });

  return getPayrun(id);
}

export async function removePayrun(id: string): Promise<string> {
  await requireEditablePayrun(id);
  const deletedId = await deletePayrunById(id);

  if (!deletedId) {
    throw new AppError(404, "Payrun not found");
  }

  return deletedId;
}

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export async function sendPayslips(
  id: string,
  input: SendPayslipsInput,
): Promise<SendPayslipsResult> {
  const { payrun, payslips } = await getPayrun(id);

  if (!isLocked(payrun.status)) {
    throw new AppError(409, "Validate the payrun before sending payslips");
  }

  const wanted = input.payslipIds ? new Set(input.payslipIds) : null;
  const result: SendPayslipsResult = {
    transport: mailTransport(),
    sent: [],
    skipped: [],
  };

  for (const slip of payslips) {
    if (wanted && !wanted.has(slip.id)) {
      continue;
    }

    if (!EMAIL_PATTERN.test(slip.employeeEmail)) {
      result.skipped.push({
        payslipId: slip.id,
        employeeName: slip.employeeName,
        reason: "Missing or invalid work email",
      });
      continue;
    }

    try {
      const pdf = await renderPayslipPdf(slip);
      await sendMail({
        to: slip.employeeEmail,
        subject: `Your payslip for ${slip.startDate} to ${slip.endDate}`,
        text: `Hello ${slip.employeeName},\n\nPlease find your payslip for ${slip.startDate} to ${slip.endDate} attached.\n\nNet pay: Rs ${slip.net.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n\nPeoplePay360 HR & Payroll`,
        attachments: [
          {
            filename: payslipFilename(slip),
            content: Buffer.from(pdf),
            contentType: "application/pdf",
          },
        ],
      });
      result.sent.push(slip.id);
    } catch (error) {
      logger.error({ err: error, payslipId: slip.id }, "payslip delivery failed");
      result.skipped.push({
        payslipId: slip.id,
        employeeName: slip.employeeName,
        reason: "Delivery failed",
      });
    }
  }

  // Only real deliveries count as sent history.
  if (result.transport === "smtp" && result.sent.length > 0) {
    await markPayslipsSent(result.sent);
    await updatePayrunStatus(id, payrun.status, { sent_at: "now" });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Payslips
// ---------------------------------------------------------------------------

export function listPayslips(query: ListPayslipsQuery): Promise<PayslipRecord[]> {
  return findAllPayslips(query);
}

export async function getPayslip(id: string): Promise<PayslipRecord> {
  const payslip = await findPayslipById(id);

  if (!payslip) {
    throw new AppError(404, "Payslip not found");
  }

  return payslip;
}

export async function removePayslip(id: string): Promise<string> {
  const payslip = await getPayslip(id);
  const payrun = await requireEditablePayrun(payslip.payrunId);

  if (payrun.payslipCount <= 1) {
    throw new AppError(409, "Delete the payrun to remove its last payslip");
  }

  const deletedId = await deletePayslipById(id);

  if (!deletedId) {
    throw new AppError(404, "Payslip not found");
  }

  return deletedId;
}

export async function getPayslipPdf(
  id: string,
): Promise<{ filename: string; bytes: Uint8Array }> {
  const payslip = await getPayslip(id);

  if (payslip.status === "draft") {
    throw new AppError(409, "Compute the payrun before printing this payslip");
  }

  return { filename: payslipFilename(payslip), bytes: await renderPayslipPdf(payslip) };
}

// ---------------------------------------------------------------------------
// Bank details
// ---------------------------------------------------------------------------

export function getBankDetails(employeeId: string): Promise<BankDetailsRecord | null> {
  return findBankDetails(employeeId);
}

export async function saveBankDetails(
  employeeId: string,
  input: BankDetailsInput,
): Promise<BankDetailsRecord> {
  try {
    return await upsertBankDetails(employeeId, input);
  } catch (caught) {
    const code = getErrorCode(caught);

    if (code === "23503") {
      throw new AppError(404, "Employee not found");
    }

    return rethrow(caught);
  }
}

export { selectPeriodContract };
