import { AppError } from "../errors/AppError";
import { getCached, setCached } from "../lib/cache";
import { evaluateFormula, validateRuleSequence } from "../lib/payroll-engine";
import {
  countStructuresUsingRule,
  deleteSalaryRuleById,
  findAllSalaryRules,
  findRulesForStructure,
  findSalaryRuleById,
  insertSalaryRule,
  updateSalaryRuleById,
} from "../repositories/salary-rule.repository";
import { findAllSalaryStructures } from "../repositories/salary-structure.repository";
import {
  CreateSalaryRuleInput,
  ListSalaryRulesQuery,
  UpdateSalaryRuleInput,
} from "../types/payroll.dto";
import {
  FORMULA_VARIABLES,
  SalaryRuleListResult,
  SalaryRuleRecord,
} from "../types/payroll";
import { invalidatePayrollCaches, payrollListCacheKey } from "./payroll-cache";

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as { code?: string }).code;
}

function toDomainError(error: unknown): AppError | null {
  const code = getErrorCode(error);

  if (code === "23505") {
    return new AppError(409, "A salary rule already uses this code");
  }

  if (code === "23514") {
    return new AppError(400, "Salary rule violates a database constraint");
  }

  if (code === "23503") {
    return new AppError(
      409,
      "This salary rule is used by a salary structure, remove it there first",
    );
  }

  return null;
}

/**
 * A rule never stands alone: it runs inside every structure that includes it.
 * An edit is rejected before it is written when it would break the calculation
 * of any of them -- a duplicate sequence, or a formula referencing a code that
 * no longer runs earlier.
 */
async function assertStructuresStayValid(
  replacement: SalaryRuleRecord,
): Promise<void> {
  const { rows: structures } = await findAllSalaryStructures({
    limit: 200,
    offset: 0,
  });

  for (const structure of structures) {
    if (!structure.ruleIds.includes(replacement.id)) {
      continue;
    }

    const rules = await findRulesForStructure(structure.id);
    const error = validateRuleSequence(
      rules
        .map((rule) => (rule.id === replacement.id ? replacement : rule))
        .filter((rule) => rule.active),
    );

    if (error) {
      throw new AppError(409, `${structure.name}: ${error}`);
    }
  }
}

/**
 * A rule can only reference a payroll input or a rule that runs before it. This
 * catches a typo at the moment it is written rather than when a payslip built
 * on the rule silently fails to calculate.
 */
async function assertReferencesResolve(rule: {
  id?: string;
  name: string;
  sequence: number;
  method: string;
  base: string;
  formula: string;
}): Promise<void> {
  if (rule.method === "fixed") {
    return;
  }

  const { rows: existing } = await findAllSalaryRules({
    limit: 200,
    offset: 0,
  });

  const context: Record<string, number> = Object.fromEntries(
    FORMULA_VARIABLES.map((code) => [code, 1]),
  );

  for (const other of existing) {
    if (other.id !== rule.id && other.active && other.sequence < rule.sequence) {
      context[other.code] = 1;
    }
  }

  try {
    evaluateFormula(
      rule.method === "percentage" ? rule.base : rule.formula,
      context,
    );
  } catch (error) {
    throw new AppError(400, `${rule.name}: ${(error as Error).message}`);
  }
}

export async function createSalaryRule(
  input: CreateSalaryRuleInput,
): Promise<SalaryRuleRecord> {
  await assertReferencesResolve(input);

  try {
    const rule = await insertSalaryRule(input);

    await invalidatePayrollCaches();

    return rule;
  } catch (error) {
    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function listSalaryRules(
  query: ListSalaryRulesQuery,
): Promise<SalaryRuleListResult> {
  const cacheKey = await payrollListCacheKey("rules", query);
  const cached = await getCached<SalaryRuleListResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const { rows, total } = await findAllSalaryRules(query);

  const result: SalaryRuleListResult = {
    rules: rows,
    pagination: {
      total,
      limit: query.limit,
      offset: query.offset,
      hasMore: query.offset + rows.length < total,
    },
  };

  await setCached(cacheKey, result);

  return result;
}

export async function getSalaryRule(id: string): Promise<SalaryRuleRecord> {
  const rule = await findSalaryRuleById(id);

  if (!rule) {
    throw new AppError(404, "Salary rule not found");
  }

  return rule;
}

export async function updateSalaryRule(
  id: string,
  input: UpdateSalaryRuleInput,
): Promise<SalaryRuleRecord> {
  const existing = await findSalaryRuleById(id);

  if (!existing) {
    throw new AppError(404, "Salary rule not found");
  }

  const merged: SalaryRuleRecord = { ...existing, ...input };

  if (merged.method === "percentage" && !merged.base) {
    throw new AppError(400, "A percentage rule needs a base such as BASIC");
  }

  if (merged.method === "formula" && !merged.formula) {
    throw new AppError(400, "A formula rule needs a formula");
  }

  await assertReferencesResolve(merged);
  await assertStructuresStayValid(merged);

  try {
    const rule = await updateSalaryRuleById(id, input);

    if (!rule) {
      throw new AppError(404, "Salary rule not found");
    }

    await invalidatePayrollCaches();

    return rule;
  } catch (error) {
    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function removeSalaryRule(id: string): Promise<string> {
  const usedBy = await countStructuresUsingRule(id);

  if (usedBy > 0) {
    throw new AppError(
      409,
      "Remove this rule from its salary structures before deleting it",
    );
  }

  const deletedId = await deleteSalaryRuleById(id);

  if (!deletedId) {
    throw new AppError(404, "Salary rule not found");
  }

  await invalidatePayrollCaches();

  return deletedId;
}
