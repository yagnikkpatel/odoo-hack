import { ApiError } from '@/lib/api-client'
import type {
  Contract,
  ContractHistoryAction,
  ContractHistoryEntry,
  ContractPagination,
  ContractStatus,
} from './types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('The contract service returned an invalid response.', 502)
  }
  return value as Record<string, unknown>
}

export function requireContractId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ApiError('A valid contract ID is required.', 400)
  }
  return value
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(`The contract service returned an invalid ${field}.`, 502)
  }
  return value.trim()
}

function date(value: unknown, field: string): string {
  const result = requiredText(value, field)
  if (!DATE_PATTERN.test(result)) {
    throw new ApiError(`The contract service returned an invalid ${field}.`, 502)
  }
  return result
}

function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ApiError('The contract service returned invalid pagination.', 502)
  }
  return value
}

function status(value: unknown): ContractStatus {
  if (value !== 'running' && value !== 'expired') {
    throw new ApiError('The contract service returned an invalid status.', 502)
  }
  return value
}

function employeeAvatar(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href
  } catch {
    // A missing or invalid optional photo must not hide the contract.
  }
  return undefined
}

export function mapContract(value: unknown): Contract {
  const record = requireRecord(value)
  if (
    typeof record.wage !== 'number' ||
    !Number.isFinite(record.wage) ||
    record.wage <= 0
  ) {
    throw new ApiError('The contract service returned an invalid wage.', 502)
  }
  const contract: Contract = {
    id: requireContractId(record.id),
    employeeId: requireContractId(record.employeeId),
    employeeName: requiredText(record.employeeName, 'employee name'),
    employeeEmail: requiredText(record.employeeEmail, 'employee email'),
    startDate: date(record.startDate, 'start date'),
    endDate: date(record.endDate, 'end date'),
    wage: record.wage,
    status: status(record.status),
    createdAt: requiredText(record.createdAt, 'created timestamp'),
    updatedAt: requiredText(record.updatedAt, 'updated timestamp'),
  }
  const avatar = employeeAvatar(record.employeeAvatar)
  if (avatar) contract.employeeAvatar = avatar
  return contract
}

const HISTORY_ACTIONS = new Set(['created', 'updated', 'deleted'])

function historyAction(value: unknown): ContractHistoryAction {
  if (typeof value !== 'string' || !HISTORY_ACTIONS.has(value)) {
    throw new ApiError('The contract service returned an invalid history action.', 502)
  }
  return value as ContractHistoryAction
}

export function mapContractHistoryEntry(value: unknown): ContractHistoryEntry {
  const record = requireRecord(value)
  const changes = record.changes
  const snapshot = requireRecord(record.snapshot)
  return {
    id: requiredText(record.id, 'history id'),
    contractId: requireContractId(record.contractId),
    employeeId: requireContractId(record.employeeId),
    action: historyAction(record.action),
    changes:
      changes && typeof changes === 'object' && !Array.isArray(changes)
        ? (changes as ContractHistoryEntry['changes'])
        : {},
    snapshot: {
      employeeId: requireContractId(snapshot.employeeId),
      startDate: date(snapshot.startDate, 'start date'),
      endDate: date(snapshot.endDate, 'end date'),
      wage: typeof snapshot.wage === 'number' ? snapshot.wage : 0,
      status: status(snapshot.status),
    },
    changedBy:
      typeof record.changedBy === 'string' && record.changedBy
        ? record.changedBy
        : null,
    changedByName:
      typeof record.changedByName === 'string' && record.changedByName
        ? record.changedByName
        : null,
    createdAt: requiredText(record.createdAt, 'history timestamp'),
  }
}

export function mapPagination(value: unknown): ContractPagination {
  const record = requireRecord(value)
  const limit = count(record.limit)
  if (limit < 1 || limit > 100 || typeof record.hasMore !== 'boolean') {
    throw new ApiError('The contract service returned invalid pagination.', 502)
  }
  return {
    total: count(record.total),
    limit,
    offset: count(record.offset),
    hasMore: record.hasMore,
  }
}
