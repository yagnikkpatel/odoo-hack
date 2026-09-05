import { AppError } from "../errors/AppError";
import {
  bumpCacheVersion,
  getCacheVersion,
  getCached,
  invalidateCache,
  setCached,
} from "../lib/cache";
import {
  deleteContractById,
  findAllContracts,
  findContractById,
  insertContract,
  updateContractById,
} from "../repositories/contract.repository";
import {
  CreateContractInput,
  ListContractsQuery,
  UpdateContractInput,
} from "../types/contract.dto";
import { ContractListResult, ContractRecord } from "../types/contract";

const CONTRACT_LIST_NAMESPACE = "contract-list";
// Employee image uploads/deletions already bump this version.
const EMPLOYEE_LIST_NAMESPACE = "employee-list";

async function contractCacheKey(id: string): Promise<string> {
  const employeeVersion = await getCacheVersion(EMPLOYEE_LIST_NAMESPACE);
  return `contract:with-avatar:${id}:employees-v${employeeVersion}`;
}

function contractListCacheKey(
  version: number,
  employeeVersion: number,
  query: ListContractsQuery,
): string {
  const parts = [
    `limit=${query.limit}`,
    `offset=${query.offset}`,
    `status=${query.status ?? ""}`,
    `employeeId=${query.employeeId ?? ""}`,
    `search=${query.search ?? ""}`,
  ];

  return `${CONTRACT_LIST_NAMESPACE}:with-avatar:v${version}:employees-v${employeeVersion}:${parts.join("&")}`;
}

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
    if (constraint === "contracts_salary_structure_id_fkey") {
      return new AppError(404, "Salary structure not found");
    }

    return new AppError(404, "Employee not found");
  }

  if (code === "23505") {
    return new AppError(
      409,
      "This employee already has a running contract, expire it first",
    );
  }

  if (code === "23514") {
    if (constraint === "contracts_date_range_check") {
      return new AppError(400, "endDate must be after startDate");
    }

    if (constraint === "contracts_wage_check") {
      return new AppError(400, "wage must be greater than 0");
    }

    return new AppError(400, "Contract violates a database constraint");
  }

  return null;
}

async function invalidateContractCaches(id: string): Promise<void> {
  await invalidateCache([await contractCacheKey(id)]);
  await bumpCacheVersion(CONTRACT_LIST_NAMESPACE);
}

export async function createContract(
  input: CreateContractInput,
): Promise<ContractRecord> {
  try {
    const contract = await insertContract(input);

    await invalidateContractCaches(contract.id);

    return contract;
  } catch (error) {
    const domainError = toDomainError(error);

    if (domainError) {
      throw domainError;
    }

    throw error;
  }
}

export async function listContracts(
  query: ListContractsQuery,
): Promise<ContractListResult> {
  const [version, employeeVersion] = await Promise.all([
    getCacheVersion(CONTRACT_LIST_NAMESPACE),
    getCacheVersion(EMPLOYEE_LIST_NAMESPACE),
  ]);
  const cacheKey = contractListCacheKey(version, employeeVersion, query);
  const cached = await getCached<ContractListResult>(cacheKey);

  if (cached) {
    return cached;
  }

  const { rows, total } = await findAllContracts(query);

  const result: ContractListResult = {
    contracts: rows,
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

export async function getContract(id: string): Promise<ContractRecord> {
  const cacheKey = await contractCacheKey(id);
  const cached = await getCached<ContractRecord>(cacheKey);

  if (cached) {
    return cached;
  }

  const contract = await findContractById(id);

  if (!contract) {
    throw new AppError(404, "Contract not found");
  }

  await setCached(cacheKey, contract);

  return contract;
}

export async function updateContract(
  id: string,
  input: UpdateContractInput,
): Promise<ContractRecord> {
  const existing = await findContractById(id);

  if (!existing) {
    throw new AppError(404, "Contract not found");
  }

  const startDate = input.startDate ?? existing.startDate;
  const endDate = input.endDate ?? existing.endDate;

  if (endDate <= startDate) {
    throw new AppError(400, "endDate must be after startDate");
  }

  try {
    const contract = await updateContractById(id, input);

    if (!contract) {
      throw new AppError(404, "Contract not found");
    }

    await invalidateContractCaches(id);

    return contract;
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

export async function removeContract(id: string): Promise<string> {
  const deletedId = await deleteContractById(id);

  if (!deletedId) {
    throw new AppError(404, "Contract not found");
  }

  await invalidateContractCaches(id);

  return deletedId;
}
