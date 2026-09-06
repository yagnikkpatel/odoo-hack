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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const RULE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,31}$/
// Rejects the display-name and list forms a mail header would accept, so an
// address typed here cannot smuggle a second recipient to the mail server.
const EMAIL_PATTERN = /^[^\s@<>,;:"\\[\]]+@[^\s@<>,;:"\\[\]]+\.[a-z]{2,}$/i
const MAX_JSON_BYTES = 65_536

const RULE_CATEGORIES = [
  'basic',
  'allowance',
  'gross',
  'deduction',
  'contribution',
  'net',
] as const
const COMPUTATION_METHODS = ['fixed', 'percentage', 'formula'] as const
const PAYROLL_STATUSES = ['draft', 'computed', 'validated', 'paid'] as const

class PayrollRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'PayrollRequestError'
  }
}

/**
 * The shape of one accepted field. Anything the backend does not take is
 * rejected here rather than forwarded, so this route can never widen the API.
 */
type Field =
  | { kind: 'uuid' }
  | { kind: 'date' }
  | { kind: 'boolean' }
  | { kind: 'enum'; values: readonly string[] }
  | { kind: 'text'; max: number; min?: number; pattern?: RegExp }
  | { kind: 'number'; min: number; max: number; integer?: boolean }
  | { kind: 'uuids'; max: number }
  | { kind: 'sequences'; max: number }
  | { kind: 'recipients'; max: number }

type Shape = {
  fields: Record<string, Field>
  required: string[]
  /** Send takes an empty body -- it means "everyone, at the address on file". */
  allowEmpty?: boolean
}

function invalid(name: string): never {
  throw new PayrollRequestError(400, `The ${name} value is not valid.`)
}

function readField(name: string, field: Field, value: unknown): unknown {
  switch (field.kind) {
    case 'uuid':
      if (typeof value !== 'string' || !UUID_PATTERN.test(value)) invalid(name)
      return value
    case 'date':
      if (
        typeof value !== 'string' ||
        !DATE_PATTERN.test(value) ||
        Number.isNaN(Date.parse(value))
      ) {
        invalid(name)
      }
      return value
    case 'boolean':
      if (typeof value !== 'boolean') invalid(name)
      return value
    case 'enum':
      if (typeof value !== 'string' || !field.values.includes(value)) invalid(name)
      return value
    case 'text': {
      if (typeof value !== 'string') invalid(name)
      const text = value.trim()
      if (text.length < (field.min ?? 0) || text.length > field.max) invalid(name)
      if (field.pattern && text && !field.pattern.test(text)) invalid(name)
      return text
    }
    case 'number':
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < field.min ||
        value > field.max ||
        (field.integer && !Number.isInteger(value))
      ) {
        invalid(name)
      }
      return value
    case 'uuids': {
      if (
        !Array.isArray(value) ||
        value.length === 0 ||
        value.length > field.max ||
        value.some(item => typeof item !== 'string' || !UUID_PATTERN.test(item))
      ) {
        invalid(name)
      }
      return value
    }
    case 'recipients': {
      if (!Array.isArray(value) || value.length > field.max) invalid(name)
      return value.map(item => {
        if (
          !isRecord(item) ||
          Object.keys(item).length !== 2 ||
          typeof item.payslipId !== 'string' ||
          !UUID_PATTERN.test(item.payslipId) ||
          typeof item.email !== 'string'
        ) {
          invalid(name)
        }
        const email = item.email.trim()
        if (email.length > 254 || !EMAIL_PATTERN.test(email)) invalid(name)
        return { payslipId: item.payslipId, email }
      })
    }
    case 'sequences': {
      if (!Array.isArray(value) || value.length > field.max) invalid(name)
      return value.map(item => {
        if (
          !isRecord(item) ||
          Object.keys(item).length !== 2 ||
          typeof item.id !== 'string' ||
          !UUID_PATTERN.test(item.id) ||
          typeof item.sequence !== 'number' ||
          !Number.isInteger(item.sequence) ||
          item.sequence < 0 ||
          item.sequence > 100_000
        ) {
          invalid(name)
        }
        return { id: item.id, sequence: item.sequence }
      })
    }
  }
}

const SALARY_RULE_FIELDS: Record<string, Field> = {
  name: { kind: 'text', min: 1, max: 100 },
  code: { kind: 'text', min: 1, max: 32, pattern: RULE_CODE_PATTERN },
  category: { kind: 'enum', values: RULE_CATEGORIES },
  sequence: { kind: 'number', min: 0, max: 100_000, integer: true },
  method: { kind: 'enum', values: COMPUTATION_METHODS },
  amount: { kind: 'number', min: 0, max: 999_999_999_999.99 },
  percentage: { kind: 'number', min: 0, max: 1000 },
  base: { kind: 'text', max: 500 },
  formula: { kind: 'text', max: 500 },
  quantity: { kind: 'number', min: 0, max: 10_000 },
  active: { kind: 'boolean' },
}

const SALARY_STRUCTURE_FIELDS: Record<string, Field> = {
  name: { kind: 'text', min: 1, max: 100 },
  description: { kind: 'text', max: 500 },
  active: { kind: 'boolean' },
  ruleIds: { kind: 'uuids', max: 200 },
  ruleSequences: { kind: 'sequences', max: 200 },
}

const PAYRUN_FIELDS: Record<string, Field> = {
  name: { kind: 'text', min: 1, max: 120 },
  structureId: { kind: 'uuid' },
  startDate: { kind: 'date' },
  endDate: { kind: 'date' },
  employeeIds: { kind: 'uuids', max: 500 },
}

export const PAYROLL_BODIES = {
  'rule:create': {
    fields: SALARY_RULE_FIELDS,
    required: ['name', 'code', 'category', 'sequence', 'method'],
  },
  'rule:update': { fields: SALARY_RULE_FIELDS, required: [] },
  'structure:create': {
    fields: SALARY_STRUCTURE_FIELDS,
    required: ['name', 'ruleIds'],
  },
  'structure:update': { fields: SALARY_STRUCTURE_FIELDS, required: [] },
  'payrun:create': {
    fields: PAYRUN_FIELDS,
    required: ['name', 'structureId', 'startDate', 'endDate', 'employeeIds'],
  },
  'payrun:update': {
    fields: PAYRUN_FIELDS,
    required: ['name', 'structureId', 'startDate', 'endDate', 'employeeIds'],
  },
  'bank-account': {
    fields: { accountNumber: { kind: 'text', min: 4, max: 64 } as Field },
    required: ['accountNumber'],
  },
  'payrun:send': {
    fields: {
      payslipIds: { kind: 'uuids', max: 500 },
      recipients: { kind: 'recipients', max: 500 },
    },
    required: [],
    allowEmpty: true,
  },
  'payslip:send': {
    fields: {
      email: { kind: 'text', min: 3, max: 254, pattern: EMAIL_PATTERN } as Field,
    },
    required: [],
    allowEmpty: true,
  },
} satisfies Record<string, Shape>

export type PayrollBody = keyof typeof PAYROLL_BODIES

const QUERIES = {
  'salary-rules': {
    limit: { kind: 'number', min: 1, max: 200, integer: true },
    offset: { kind: 'number', min: 0, max: 2_147_483_647, integer: true },
    search: { kind: 'text', min: 1, max: 120 },
    category: { kind: 'enum', values: RULE_CATEGORIES },
    structureId: { kind: 'uuid' },
    active: { kind: 'enum', values: ['true', 'false'] },
  },
  'salary-structures': {
    limit: { kind: 'number', min: 1, max: 200, integer: true },
    offset: { kind: 'number', min: 0, max: 2_147_483_647, integer: true },
    search: { kind: 'text', min: 1, max: 120 },
    active: { kind: 'enum', values: ['true', 'false'] },
  },
  payruns: {
    limit: { kind: 'number', min: 1, max: 100, integer: true },
    offset: { kind: 'number', min: 0, max: 2_147_483_647, integer: true },
    search: { kind: 'text', min: 1, max: 120 },
    status: { kind: 'enum', values: PAYROLL_STATUSES },
    structureId: { kind: 'uuid' },
    from: { kind: 'date' },
    to: { kind: 'date' },
  },
  payslips: {
    limit: { kind: 'number', min: 1, max: 200, integer: true },
    offset: { kind: 'number', min: 0, max: 2_147_483_647, integer: true },
    search: { kind: 'text', min: 1, max: 120 },
    status: { kind: 'enum', values: PAYROLL_STATUSES },
    payrunId: { kind: 'uuid' },
    employeeId: { kind: 'uuid' },
    department: { kind: 'text', min: 1, max: 120 },
    from: { kind: 'date' },
    to: { kind: 'date' },
  },
  // The dashboard is a read of one period. The period bounds are required, so
  // an unfiltered request can never ask the API to aggregate all of payroll.
  dashboard: {
    startDate: { kind: 'date' },
    endDate: { kind: 'date' },
    department: { kind: 'text', min: 1, max: 120 },
    jobPosition: { kind: 'text', min: 1, max: 120 },
    currency: { kind: 'text', min: 3, max: 3, pattern: /^[A-Za-z]{3}$/ },
  },
  'eligible-employees': {
    startDate: { kind: 'date' },
    endDate: { kind: 'date' },
    search: { kind: 'text', min: 1, max: 120 },
    department: { kind: 'text', min: 1, max: 120 },
    limit: { kind: 'number', min: 1, max: 500, integer: true },
    offset: { kind: 'number', min: 0, max: 2_147_483_647, integer: true },
  },
} satisfies Record<string, Record<string, Field>>

export type PayrollCollection = keyof typeof QUERIES

export function payrollId(id: string) {
  if (!UUID_PATTERN.test(id)) {
    throw new PayrollRequestError(400, 'Choose a valid payroll record.')
  }
  return id
}

/** Rebuilds the query string from the allowlist rather than passing it through. */
export function payrollListPath(
  collection: PayrollCollection,
  request: Request,
) {
  const allowed: Record<string, Field> = QUERIES[collection]
  const input = new URL(request.url).searchParams
  const output = new URLSearchParams()

  for (const [key, rawValue] of input) {
    const field = allowed[key]
    if (!field || input.getAll(key).length !== 1) {
      throw new PayrollRequestError(400, `Unsupported payroll filter: ${key}.`)
    }
    const value = rawValue.trim()
    if (field.kind === 'number') {
      if (!/^\d+$/.test(value)) invalid(key)
      readField(key, field, Number(value))
    } else {
      readField(key, field, value)
    }
    output.set(key, value)
  }

  const query = output.toString()
  return query ? `/payroll/${collection}?${query}` : `/payroll/${collection}`
}

async function readLimitedBody(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_JSON_BYTES) {
    throw new PayrollRequestError(413, 'This request is too large.')
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > MAX_JSON_BYTES) {
    throw new PayrollRequestError(413, 'This request is too large.')
  }
  return new TextDecoder().decode(bytes)
}

async function readPayrollInput(request: Request, kind: PayrollBody) {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    throw new PayrollRequestError(415, 'Send payroll details as JSON.')
  }
  let input: unknown
  try {
    input = JSON.parse(await readLimitedBody(request))
  } catch (error) {
    if (error instanceof PayrollRequestError) throw error
    throw new PayrollRequestError(400, 'Payroll details must be valid JSON.')
  }
  if (!isRecord(input)) {
    throw new PayrollRequestError(400, 'Provide the payroll details.')
  }

  const shape: Shape = PAYROLL_BODIES[kind]
  const output: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(input)) {
    const field = shape.fields[key]
    if (!field) {
      throw new PayrollRequestError(
        400,
        `This payroll request does not support the field ${key}.`,
      )
    }
    output[key] = readField(key, field, value)
  }

  for (const key of shape.required) {
    if (!Object.hasOwn(output, key)) {
      throw new PayrollRequestError(400, `The ${key} field is required.`)
    }
  }
  if (
    !shape.allowEmpty &&
    shape.required.length === 0 &&
    Object.keys(output).length === 0
  ) {
    throw new PayrollRequestError(400, 'Provide at least one field to update.')
  }
  return output
}

function backendError(status: number, payload: unknown) {
  if (status === 401) {
    return authError('Your session has expired. Sign in again.', 401)
  }
  if (status === 403) {
    return authError(
      'Your account does not have permission to perform this payroll action.',
      403,
    )
  }
  // 503 carries the reason payroll email is unavailable, which the operator
  // has to see to fix it, so it is passed through rather than flattened to 502.
  if ([400, 404, 409, 413, 415, 422, 429, 503].includes(status)) {
    let message = 'The payroll request could not be completed.'
    if (
      isRecord(payload) &&
      typeof payload.message === 'string' &&
      payload.message.length <= 1000
    ) {
      message = payload.message
    }
    return authError(message, status)
  }
  return authError(
    'The payroll service could not complete this request. Please try again.',
    502,
  )
}

type PayrollOperation = {
  path: () => string
  body?: PayrollBody
}

export async function handlePayrollRequest(
  request: Request,
  operation: PayrollOperation,
) {
  if (request.method !== 'GET') {
    const rejected = checkSameOrigin(request)
    if (rejected) return rejected
  }
  try {
    const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
    if (!token || !(await readVerifiedUser(token))) {
      return authError('Sign in to continue.', 401)
    }
    const headers = new Headers({
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    })
    let body: string | undefined
    if (operation.body) {
      body = JSON.stringify(await readPayrollInput(request, operation.body))
      headers.set('Content-Type', 'application/json')
    }
    const response = await fetch(getBackendApiEndpoint(operation.path()), {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'error',
      // Computing a payrun runs the salary rules for every selected employee.
      signal: AbortSignal.timeout(30_000),
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) return backendError(response.status, payload)
    if (!isRecord(payload) || payload.success !== true) {
      return authError('The payroll service returned an invalid response.', 502)
    }
    const result: Record<string, unknown> = { success: true }
    if (Object.hasOwn(payload, 'data')) result.data = payload.data
    return authJson(result, response.status)
  } catch (error) {
    if (error instanceof PayrollRequestError) {
      return authError(error.message, error.status)
    }
    return authError(
      'The payroll service is currently unavailable. Please try again shortly.',
      503,
    )
  }
}
