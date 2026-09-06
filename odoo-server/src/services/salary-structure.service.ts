import { AppError } from "../errors/AppError";
import { getCached, setCached } from "../lib/cache";
import { validateRuleSequence } from "../lib/payroll-engine";
import {
  findRulesForStructure,
  findSalaryRulesByIds,
} from "../repositories/salary-rule.repository";
import {
  countPayrunsUsingStructure,
  deleteSalaryStructureById,
  findAllSalaryStructures,
  findSalaryStructureById,
  insertSalaryStructure,
  updateSalaryStructureById,
} from "../repositories/salary-structure.repository";
import {
  CreateSalaryStructureInput,
  ListSalaryStructuresQuery,
  UpdateSalaryStructureInput,
} from "../types/payroll.dto";
import {
  SalaryRuleRecord,
  SalaryStructureListResult,
  SalaryStructureRecord,
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
    return new AppError(409, "A salary structure already uses this name");
  }

  if (code === "23503") {
    return new AppError(404, "One of the selected salary rules no longer exists");
  }

  if (code === "23514") {
    return new AppError(400, "Salary structure violates a database constraint");
  }

  return null;
}

/**
 * Loads the rules a save is about to store and checks they can run as one
 * sequence, applying the sequence changes the request carries -- reordering is
 * part of saving a structure, so it has to be validated against the new order.
 */
async function loadValidatedRules(
  ruleIds: string[],
  ruleSequences: { id: string; sequence: number }[],
): Promise<SalaryRuleRecord[]> {
  const unique = [...new Set(ruleIds)];
  const rules = await findSalaryRulesByIds(unique);

  if (rules.length !== unique.length) {
    throw new AppError(404, "One of the selected salary rules no longer exists");
  }

  const reordered = rules.map((rule) => ({
    ...rule,
    sequence:
      ruleSequences.find((sequence) => sequence.id === rule.id)?.sequence ??
      rule.sequence,
  }));

  const error = validateRuleSequence(reordered.filter((rule) => rule.active));

  if (error) {
    throw new AppError(400, error);
  }

  return reordered;
}

/**
 * A sequence belongs to the rule, so renumbering here also renumbers the rule
 * inside every other structure that includes it. Those have to stay valid too.
 */
async function assertOtherStructuresStayValid(
  structureId: string | null,
  reordered: SalaryRuleRecord[],
): Promise<void> {
  if (reordered.length === 0) {
    return;
  }

  const { rows: structures } = await findAllSalaryStructures({
    limit: 200,
    offset: 0,
  });

  for (const structure of structures) {
    if (structure.id === structureId) {
      continue;
    }

    if (!structure.ruleIds.some((id) => reordered.some((rule) => rule.id === id))) {
      continue;
    }

    const rules = await findRulesForStructure(structure.id);
    const error = validateRuleSequence(
      rules
        .map((rule) => reordered.find((item) => item.id === rule.id) ?? rule)
        .filter((rule) => rule.active),
    );

    if (error) {
      throw new AppError(409, `${structure.name}: ${error}`);
    }
  }
}

/** Only the rules whose sequence the request actually changes. */
function changedSequences(
  reordered: SalaryRuleRecord[],
  input: { ruleSequences?: { id: string; sequence: number }[] },
): SalaryRuleRecord[] {
  const changed = new Set((input.ruleSequences ?? []).map((item) => item.id));

  return reordered.filter((rule) => changed.has(rule.id));
}

export async function createSalaryStructure(
  input: CreateSalaryStructureInput,
): Promise<SalaryStructureRecord> {
  const reordered = await loadValidatedRules(input.ruleIds, input.ruleSequences);

  await assertOtherStructuresStayValid(null, changedSequences(reordered, input));

  try {
    const structure = await insertSalaryStructure({
      ...input,
      ruleIds: [...new Set(input.ruleIds)],
    });

    await invalidatePayrollCaches();

    return structure;
  } catch (error) {
    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function listSalaryStructures(
  query: ListSalaryStructuresQuery,
): Promise<SalaryStructureListResult> {
  const cacheKey = await payrollListCacheKey("structures", query);
  const cached = await getCached<SalaryStructureListResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const { rows, total } = await findAllSalaryStructures(query);

  const result: SalaryStructureListResult = {
    structures: rows,
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

export async function getSalaryStructure(
  id: string,
): Promise<SalaryStructureRecord> {
  const structure = await findSalaryStructureById(id);

  if (!structure) {
    throw new AppError(404, "Salary structure not found");
  }

  return structure;
}

export async function updateSalaryStructure(
  id: string,
  input: UpdateSalaryStructureInput,
): Promise<SalaryStructureRecord> {
  const existing = await findSalaryStructureById(id);

  if (!existing) {
    throw new AppError(404, "Salary structure not found");
  }

  const ruleIds = input.ruleIds ?? existing.ruleIds;
  const ruleSequences = input.ruleSequences ?? [];
  const reordered = await loadValidatedRules(ruleIds, ruleSequences);

  await assertOtherStructuresStayValid(id, changedSequences(reordered, input));

  try {
    const structure = await updateSalaryStructureById(
      id,
      {
        name: input.name,
        description: input.description,
        active: input.active,
      },
      input.ruleIds ? [...new Set(input.ruleIds)] : undefined,
      ruleSequences,
    );

    if (!structure) {
      throw new AppError(404, "Salary structure not found");
    }

    await invalidatePayrollCaches();

    return structure;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function removeSalaryStructure(id: string): Promise<string> {
  const usedBy = await countPayrunsUsingStructure(id);

  if (usedBy > 0) {
    throw new AppError(
      409,
      "This structure is used by a payrun. Switch it inactive to archive it instead",
    );
  }

  const deletedId = await deleteSalaryStructureById(id);

  if (!deletedId) {
    throw new AppError(404, "Salary structure not found");
  }

  await invalidatePayrollCaches();

  return deletedId;
}

/** The rules a payrun will run, in execution order. */
export async function getStructureRules(
  structureId: string,
): Promise<SalaryRuleRecord[]> {
  return findRulesForStructure(structureId);
}
