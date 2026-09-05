import { ApiError } from '@/lib/api-client'
import type {
  Allocation,
  ApprovalStatus,
  ApprovalPolicy,
  Consumption,
  DayCharge,
  Decision,
  LeaveUnit,
  PayrollTreatment,
  RequestStatus,
  TimeOffData,
  TimeOffRequest,
  TimeOffType,
} from './model'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function invalid(field = 'response'): never {
  throw new ApiError(`The time off service returned an invalid ${field}.`, 502)
}

export function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid()
  return value as Record<string, unknown>
}

export function requireTimeOffId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) {
    throw new ApiError('A valid time off ID is required.', 400)
  }
  return value
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) invalid(field)
  return value as string
}

function optionalText(value: unknown, field: string): string {
  if (typeof value !== 'string') invalid(field)
  return value as string
}

function flag(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') invalid(field)
  return value as boolean
}

function member<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) invalid(field)
  return value as T
}

function date(value: unknown, field: string): string {
  const result = text(value, field)
  const parsed = new Date(`${result}T00:00:00Z`)
  if (
    !DATE.test(result) ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== result
  ) {
    invalid(field)
  }
  return result
}

// Open-ended allocations arrive as '' on the wire, never null.
function openEndedDate(value: unknown, field: string): string {
  return value === '' ? '' : date(value, field)
}

function clockTime(value: unknown, field: string): string {
  const result = optionalText(value, field)
  if (result !== '' && !TIME.test(result)) invalid(field)
  return result
}

function timestamp(value: unknown): string {
  const result = text(value, 'timestamp')
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(result) ||
    !Number.isFinite(Date.parse(result))
  ) {
    invalid('timestamp')
  }
  return result
}

function amount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) invalid(field)
  return value as number
}

function list(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) invalid(field)
  return value as unknown[]
}

function mapDecision(value: unknown): Decision {
  const record = requireRecord(value)
  const decision: Decision = { at: timestamp(record.at), action: text(record.action, 'history action') }
  if (record.actorId !== undefined && record.actorId !== null) {
    decision.actorId = requireTimeOffId(record.actorId)
  }
  if (record.reason !== undefined && record.reason !== null) {
    decision.reason = optionalText(record.reason, 'history reason')
  }
  return decision
}

function mapHistory(value: unknown): Decision[] {
  return list(value, 'history').map(mapDecision)
}

function mapCharge(value: unknown): DayCharge {
  const record = requireRecord(value)
  return { date: date(record.date, 'charge date'), amount: amount(record.amount, 'charge amount') }
}

function mapConsumption(value: unknown): Consumption {
  const record = requireRecord(value)
  return {
    allocationId: requireTimeOffId(record.allocationId),
    date: date(record.date, 'consumption date'),
    amount: amount(record.amount, 'consumption amount'),
  }
}

export function mapTimeOffType(value: unknown): TimeOffType {
  const record = requireRecord(value)
  return {
    id: requireTimeOffId(record.id),
    name: text(record.name, 'type name'),
    code: text(record.code, 'type code'),
    unit: member<LeaveUnit>(record.unit, ['days', 'hours'], 'unit'),
    requiresAllocation: flag(record.requiresAllocation, 'allocation policy'),
    approval: member<ApprovalPolicy>(record.approval, ['manager', 'none'], 'approval policy'),
    payroll: member<PayrollTreatment>(record.payroll, ['paid', 'unpaid'], 'payroll treatment'),
    active: flag(record.active, 'active flag'),
    description: optionalText(record.description, 'description'),
    createdAt: timestamp(record.createdAt),
    updatedAt: timestamp(record.updatedAt),
  }
}

export function mapAllocation(value: unknown): Allocation {
  const record = requireRecord(value)
  return {
    id: requireTimeOffId(record.id),
    employeeId: requireTimeOffId(record.employeeId),
    typeId: requireTimeOffId(record.typeId),
    amount: amount(record.amount, 'allocation amount'),
    validFrom: date(record.validFrom, 'allocation start date'),
    validTo: openEndedDate(record.validTo, 'allocation expiry date'),
    note: optionalText(record.note, 'note'),
    status: member<ApprovalStatus>(record.status, ['pending', 'approved', 'refused'], 'status'),
    createdAt: timestamp(record.createdAt),
    updatedAt: timestamp(record.updatedAt),
    history: mapHistory(record.history),
  }
}

export function mapRequest(value: unknown): TimeOffRequest {
  const record = requireRecord(value)
  return {
    id: requireTimeOffId(record.id),
    employeeId: requireTimeOffId(record.employeeId),
    typeId: requireTimeOffId(record.typeId),
    startDate: date(record.startDate, 'request start date'),
    endDate: date(record.endDate, 'request end date'),
    startTime: clockTime(record.startTime, 'request start time'),
    endTime: clockTime(record.endTime, 'request end time'),
    reason: optionalText(record.reason, 'reason'),
    unit: member<LeaveUnit>(record.unit, ['days', 'hours'], 'unit'),
    duration: amount(record.duration, 'duration'),
    charges: list(record.charges, 'charges').map(mapCharge),
    consumptions: list(record.consumptions, 'consumptions').map(mapConsumption),
    status: member<RequestStatus>(
      record.status,
      ['pending', 'approved', 'refused', 'cancelled'],
      'status',
    ),
    createdAt: timestamp(record.createdAt),
    updatedAt: timestamp(record.updatedAt),
    history: mapHistory(record.history),
  }
}

export function mapSnapshot(value: unknown): TimeOffData {
  const record = requireRecord(value)
  return {
    types: list(record.types, 'type list').map(mapTimeOffType),
    allocations: list(record.allocations, 'allocation list').map(mapAllocation),
    requests: list(record.requests, 'request list').map(mapRequest),
  }
}
