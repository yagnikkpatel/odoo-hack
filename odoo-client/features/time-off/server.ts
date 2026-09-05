import 'server-only'

import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME } from '@/features/auth/auth-constants'
import {
  authError,
  authJson,
  checkSameOrigin,
  readVerifiedUser,
} from '@/features/auth/auth-server'
import { isRecord } from '@/features/auth/auth-validation'
import { getBackendApiEndpoint } from '@/lib/backend-api'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/
const CODE = /^[A-Za-z0-9_-]{1,16}$/
const UNITS = new Set(['days', 'hours'])
const APPROVALS = new Set(['manager', 'none'])
const PAYROLLS = new Set(['paid', 'unpaid'])
const MAX_BYTES = 16_384
const MAX_TEXT = 2_000
const MAX_AMOUNT = 100_000

class TimeOffRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'TimeOffRequestError'
  }
}

function reject(message: string): never {
  throw new TimeOffRequestError(400, message)
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function identifier(id: string) {
  if (!UUID.test(id)) reject('Choose a valid time off record.')
  return id
}

export function timeOffTypePath(id: string) {
  return `/time-off/types/${identifier(id)}`
}

export function timeOffAllocationPath(id: string, action?: 'approve' | 'refuse') {
  const path = `/time-off/allocations/${identifier(id)}`
  return action ? `${path}/${action}` : path
}

export function timeOffRequestPath(id: string, action?: 'approve' | 'refuse' | 'cancel') {
  const path = `/time-off/requests/${identifier(id)}`
  return action ? `${path}/${action}` : path
}

type BodyKind =
  | 'type-create'
  | 'type-update'
  | 'allocation-create'
  | 'allocation-update'
  | 'request-create'
  | 'request-update'
  | 'decision'

type FieldValue = string | number | boolean

const TYPE_FIELDS = [
  'name',
  'code',
  'unit',
  'requiresAllocation',
  'approval',
  'payroll',
  'active',
  'description',
]
const ALLOCATION_FIELDS = ['employeeId', 'typeId', 'amount', 'validFrom', 'validTo', 'note']
const REQUEST_FIELDS = [
  'employeeId',
  'typeId',
  'startDate',
  'endDate',
  'startTime',
  'endTime',
  'reason',
]

// Fields with a server-side default stay optional on create; everything the
// record cannot exist without is required. Updates accept any subset.
const SHAPES: Record<BodyKind, { allowed: string[]; required: string[] }> = {
  'type-create': { allowed: TYPE_FIELDS, required: ['name', 'code', 'unit', 'approval', 'payroll'] },
  'type-update': { allowed: TYPE_FIELDS, required: [] },
  'allocation-create': {
    allowed: ALLOCATION_FIELDS,
    required: ['employeeId', 'typeId', 'amount', 'validFrom'],
  },
  'allocation-update': { allowed: ALLOCATION_FIELDS, required: [] },
  'request-create': {
    allowed: REQUEST_FIELDS,
    required: ['employeeId', 'typeId', 'startDate', 'endDate', 'reason'],
  },
  'request-update': { allowed: REQUEST_FIELDS, required: [] },
  decision: { allowed: ['reason'], required: ['reason'] },
}

function requiredText(value: unknown, limit: number, message: string) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > limit) reject(message)
  return (value as string).trim()
}

function optionalText(value: unknown, limit: number, message: string) {
  if (typeof value !== 'string' || value.trim().length > limit) reject(message)
  return (value as string).trim()
}

// Field names carry the same meaning across every time off resource, so one
// validator covers them all; the per-kind allow list decides which may appear.
function checkField(key: string, value: unknown): FieldValue {
  switch (key) {
    case 'employeeId':
      if (typeof value !== 'string' || !UUID.test(value)) reject('Choose a valid employee.')
      return value as string
    case 'typeId':
      if (typeof value !== 'string' || !UUID.test(value)) reject('Choose a valid time off type.')
      return value as string
    case 'name':
      return requiredText(value, 100, 'Enter a name between 1 and 100 characters.')
    case 'code': {
      const code = requiredText(value, 16, 'Use a code of 1–16 letters, numbers, hyphens or underscores.')
      if (!CODE.test(code)) {
        reject('Use a code of 1–16 letters, numbers, hyphens or underscores.')
      }
      return code
    }
    case 'unit':
      if (typeof value !== 'string' || !UNITS.has(value)) reject('Choose days or hours.')
      return value as string
    case 'approval':
      if (typeof value !== 'string' || !APPROVALS.has(value)) {
        reject('Choose a valid approval policy.')
      }
      return value as string
    case 'payroll':
      if (typeof value !== 'string' || !PAYROLLS.has(value)) {
        reject('Choose a valid payroll treatment.')
      }
      return value as string
    case 'requiresAllocation':
    case 'active':
      if (typeof value !== 'boolean') reject('Choose valid leave policy settings.')
      return value
    case 'description':
      return optionalText(value, MAX_TEXT, 'Enter a description of at most 2000 characters.')
    case 'note':
      return optionalText(value, MAX_TEXT, 'Enter a note of at most 2000 characters.')
    case 'reason':
      return requiredText(value, MAX_TEXT, 'Enter a reason between 1 and 2000 characters.')
    case 'amount':
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_AMOUNT) {
        reject('Enter a positive allocation of no more than 100,000 units.')
      }
      return value as number
    case 'validFrom':
    case 'startDate':
    case 'endDate':
      if (!validDate(value)) reject(`Enter a valid ${key}.`)
      return value as string
    case 'validTo':
      if (value !== '' && !validDate(value)) reject('Enter a valid validTo.')
      return value as string
    case 'startTime':
    case 'endTime':
      if (typeof value !== 'string' || (value !== '' && !TIME.test(value))) {
        reject(`Enter a valid ${key} as HH:MM.`)
      }
      return value as string
    default:
      reject(`Time off does not support the field ${key}.`)
  }
}

function checkCombinations(fields: Record<string, FieldValue>) {
  const { validFrom, validTo, startDate, endDate, startTime, endTime } = fields
  if (typeof validFrom === 'string' && typeof validTo === 'string' && validTo && validTo < validFrom) {
    reject('Allocation expiry cannot be before its start date.')
  }
  if (typeof startDate === 'string' && typeof endDate === 'string' && endDate < startDate) {
    reject('The end date must be on or after the start date.')
  }
  if (typeof startTime === 'string' && typeof endTime === 'string') {
    if (Boolean(startTime) !== Boolean(endTime)) reject('Provide both a start and an end time.')
    if (startTime && endTime <= startTime) reject('The end time must be after the start time.')
  }
}

async function readInput(request: Request, kind: BodyKind) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new TimeOffRequestError(415, 'Send time off details as JSON.')
  }
  if (Number(request.headers.get('content-length')) > MAX_BYTES) {
    throw new TimeOffRequestError(413, 'This request is too large.')
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) {
    throw new TimeOffRequestError(413, 'This request is too large.')
  }
  let input: unknown
  try {
    input = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    reject('Time off details must be valid JSON.')
  }
  if (!isRecord(input)) reject('Provide the time off details.')
  const shape = SHAPES[kind]
  const fields: Record<string, FieldValue> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!shape.allowed.includes(key)) reject(`Time off does not support the field ${key}.`)
    fields[key] = checkField(key, value)
  }
  for (const key of shape.required) {
    if (!Object.hasOwn(fields, key)) reject(`The ${key} field is required.`)
  }
  if (!shape.required.length && !Object.keys(fields).length) {
    reject('Provide at least one time off field.')
  }
  checkCombinations(fields)
  return fields
}

function backendError(status: number, payload: unknown) {
  if (status === 401) return authError('Your session has expired. Sign in again.', 401)
  if (status === 403) {
    return authError('Your account does not have permission to perform this time off action.', 403)
  }
  if ([400, 404, 409, 413, 415, 422, 429].includes(status)) {
    let message = 'The time off request could not be completed.'
    if (isRecord(payload) && typeof payload.message === 'string' && payload.message.length <= 1000) {
      message = payload.message
    }
    return authError(message, status)
  }
  return authError('The time off service could not complete this request. Please try again.', 502)
}

type TimeOffOperation = { path: () => string; body?: BodyKind }

export async function handleTimeOffRequest(request: Request, operation: TimeOffOperation) {
  if (request.method !== 'GET') {
    const rejected = checkSameOrigin(request)
    if (rejected) return rejected
  }
  try {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
    if (!token || !(await readVerifiedUser(token))) {
      return authError('Sign in to continue.', 401)
    }
    const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${token}` })
    let body: string | undefined
    if (operation.body) {
      body = JSON.stringify(await readInput(request, operation.body))
      headers.set('Content-Type', 'application/json')
    }
    const response = await fetch(getBackendApiEndpoint(operation.path()), {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) return backendError(response.status, payload)
    if (!isRecord(payload) || payload.success !== true) {
      return authError('The time off service returned an invalid response.', 502)
    }
    return authJson({ success: true, data: payload.data }, response.status)
  } catch (error) {
    if (error instanceof TimeOffRequestError) return authError(error.message, error.status)
    return authError('The time off service is currently unavailable. Please try again shortly.', 503)
  }
}
