import 'server-only'

import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME } from '@/features/auth/auth-constants'
import { authError, authJson, checkSameOrigin, readVerifiedUser } from '@/features/auth/auth-server'
import { isRecord } from '@/features/auth/auth-validation'
import { getBackendApiEndpoint } from '@/lib/backend-api'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const RULE_CODE = /^[A-Z][A-Z0-9_]{0,31}$/
const CATEGORIES = new Set(['basic', 'allowance', 'gross', 'deduction', 'contribution', 'net'])
const METHODS = new Set(['fixed', 'percentage', 'formula'])
const STATUSES = new Set(['draft', 'computed', 'validated', 'paid'])
const EMPLOYMENT_TYPES = new Set(['full_time', 'part_time', 'contract', 'intern'])
const MAX_BYTES = 65_536

class PayrollRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'PayrollRequestError'
  }
}
function reject(message: string): never {
  throw new PayrollRequestError(400, message)
}
function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
function identifier(id: string) {
  if (!UUID.test(id)) reject('Choose a valid payroll record.')
  return id
}

export const payrollRulePath = (id: string) => `/payroll/rules/${identifier(id)}`
export const payrollStructurePath = (id: string) => `/payroll/structures/${identifier(id)}`
export function payrollPayrunPath(id: string, action?: 'compute' | 'validate' | 'mark-paid' | 'send') {
  const path = `/payroll/payruns/${identifier(id)}`
  return action ? `${path}/${action}` : path
}
export function payrollPayslipPath(id: string, action?: 'pdf') {
  const path = `/payroll/payslips/${identifier(id)}`
  return action ? `${path}/${action}` : path
}
export const payrollBankPath = (employeeId: string) => `/payroll/bank-details/${identifier(employeeId)}`

/** Forwards only allow-listed query parameters, each validated. */
export function payrollQueryPath(request: Request, base: string, allowed: readonly string[]) {
  const input = new URL(request.url).searchParams
  const output = new URLSearchParams()
  for (const [key, raw] of input) {
    if (!allowed.includes(key) || input.getAll(key).length !== 1) reject('Unsupported or repeated payroll filter.')
    const value = raw.trim()
    if (!value) continue
    switch (key) {
      case 'structureId':
      case 'payrunId':
      case 'employeeId':
        if (!UUID.test(value)) reject(`Choose a valid ${key}.`)
        break
      case 'startDate':
      case 'endDate':
      case 'from':
      case 'to':
        if (!validDate(value)) reject(`Enter a valid ${key}.`)
        break
      case 'status':
        if (!STATUSES.has(value)) reject('Choose a valid payroll status.')
        break
      case 'employmentType':
        if (!EMPLOYMENT_TYPES.has(value)) reject('Choose a valid employment type.')
        break
      case 'department':
        if (value.length > 120) reject('Enter a department of at most 120 characters.')
        break
      default:
        reject('Unsupported payroll filter.')
    }
    output.set(key, value)
  }
  const query = output.toString()
  return query ? `${base}?${query}` : base
}

type BodyKind = 'rule-create' | 'rule-update' | 'structure-create' | 'structure-update' | 'payrun-create' | 'send' | 'bank'
type FieldValue = string | number | boolean | string[] | { ruleId: string; sequence: number }[]

const RULE_FIELDS = ['name', 'code', 'category', 'sequence', 'method', 'amount', 'percentage', 'base', 'formula', 'description', 'active']
const STRUCTURE_FIELDS = ['name', 'description', 'active', 'ruleIds', 'sequences']
const BANK_FIELDS = ['accountHolder', 'accountNumber', 'ifsc', 'bankName', 'pan', 'uan']
const SHAPES: Record<BodyKind, { allowed: string[]; required: string[] }> = {
  'rule-create': { allowed: RULE_FIELDS, required: ['name', 'code', 'category'] },
  'rule-update': { allowed: RULE_FIELDS, required: [] },
  'structure-create': { allowed: STRUCTURE_FIELDS, required: ['name'] },
  'structure-update': { allowed: STRUCTURE_FIELDS, required: [] },
  'payrun-create': {
    allowed: ['name', 'structureId', 'startDate', 'endDate', 'employeeIds'],
    required: ['name', 'structureId', 'startDate', 'endDate', 'employeeIds']
  },
  send: { allowed: ['payslipIds'], required: [] },
  bank: { allowed: BANK_FIELDS, required: ['accountNumber', 'ifsc'] }
}

function limitedText(value: unknown, limit: number, field: string, required = false) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.trim().length > limit) {
    reject(required ? `Enter a ${field} of 1 to ${limit} characters.` : `The ${field} may have at most ${limit} characters.`)
  }
  return (value as string).trim()
}
function nonNegative(value: unknown, field: string, max: number) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
    reject(`Enter a valid non-negative ${field}.`)
  }
  return value as number
}
function idList(value: unknown, field: string, minimum: number) {
  if (!Array.isArray(value) || value.length < minimum || value.length > 500) reject(`Choose ${minimum ? 'at least one' : 'valid'} ${field}.`)
  return (value as unknown[]).map(item => (typeof item === 'string' && UUID.test(item) ? item : reject(`Choose valid ${field}.`)))
}

function checkField(key: string, value: unknown): FieldValue {
  switch (key) {
    case 'name':
      return limitedText(value, 120, 'name', true)
    case 'code': {
      const code = limitedText(value, 32, 'code', true).toUpperCase()
      if (!RULE_CODE.test(code)) reject('Use a code that starts with a letter and contains only uppercase letters, digits and underscores.')
      return code
    }
    case 'category':
      if (typeof value !== 'string' || !CATEGORIES.has(value)) reject('Choose a valid rule category.')
      return value as string
    case 'method':
      if (typeof value !== 'string' || !METHODS.has(value)) reject('Choose a valid computation method.')
      return value as string
    case 'sequence':
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 100_000) reject('Enter a whole, non-negative sequence.')
      return value as number
    case 'amount':
      return nonNegative(value, 'amount', 9_999_999_999.99)
    case 'percentage':
      return nonNegative(value, 'percentage', 1000)
    case 'base':
      return limitedText(value, 500, 'percentage base')
    case 'formula':
      return limitedText(value, 2000, 'formula')
    case 'description':
      return limitedText(value, 500, 'description')
    case 'active':
      if (typeof value !== 'boolean') reject('Choose a valid active state.')
      return value as boolean
    case 'ruleIds':
      return idList(value, 'salary rules', 0)
    case 'sequences':
      if (!Array.isArray(value) || value.length > 200) reject('Provide valid sequence overrides.')
      return (value as unknown[]).map(item => {
        if (!isRecord(item) || typeof item.ruleId !== 'string' || !UUID.test(item.ruleId)) reject('Provide valid sequence overrides.')
        const sequence = item.sequence
        if (typeof sequence !== 'number' || !Number.isInteger(sequence) || sequence < 0) reject('Enter a whole, non-negative sequence.')
        return { ruleId: item.ruleId as string, sequence: sequence as number }
      })
    case 'structureId':
      if (typeof value !== 'string' || !UUID.test(value)) reject('Choose a valid salary structure.')
      return value as string
    case 'startDate':
    case 'endDate':
      if (!validDate(value)) reject(`Enter a valid ${key}.`)
      return value as string
    case 'employeeIds':
      return idList(value, 'employees', 1)
    case 'payslipIds':
      return idList(value, 'payslips', 0)
    case 'accountHolder':
    case 'bankName':
      return limitedText(value, 120, key)
    case 'accountNumber':
      if (typeof value !== 'string' || !/^[0-9]{9,18}$/.test(value.trim())) reject('Enter a bank account number of 9 to 18 digits.')
      return (value as string).trim()
    case 'ifsc': {
      const ifsc = limitedText(value, 11, 'IFSC', true).toUpperCase()
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) reject('Enter a valid IFSC, for example HDFC0001234.')
      return ifsc
    }
    case 'pan': {
      const pan = limitedText(value, 10, 'PAN').toUpperCase()
      if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) reject('Enter a valid PAN, for example ABCDE1234F.')
      return pan
    }
    case 'uan': {
      const uan = limitedText(value, 12, 'UAN')
      if (uan && !/^[0-9]{12}$/.test(uan)) reject('Enter a 12 digit UAN.')
      return uan
    }
    default:
      reject(`Payroll does not support the field ${key}.`)
  }
}

async function readInput(request: Request, kind: BodyKind) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new PayrollRequestError(415, 'Send payroll details as JSON.')
  }
  if (Number(request.headers.get('content-length')) > MAX_BYTES) {
    throw new PayrollRequestError(413, 'This request is too large.')
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) throw new PayrollRequestError(413, 'This request is too large.')
  let input: unknown = {}
  if (bytes.byteLength > 0) {
    try {
      input = JSON.parse(new TextDecoder().decode(bytes))
    } catch {
      reject('Payroll details must be valid JSON.')
    }
  }
  if (!isRecord(input)) reject('Provide the payroll details.')
  const shape = SHAPES[kind]
  const fields: Record<string, FieldValue> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!shape.allowed.includes(key)) reject(`Payroll does not support the field ${key}.`)
    fields[key] = checkField(key, value)
  }
  for (const key of shape.required) {
    if (!Object.hasOwn(fields, key)) reject(`The ${key} field is required.`)
  }
  if (!shape.required.length && kind !== 'send' && !Object.keys(fields).length) reject('Provide at least one payroll field.')
  if (typeof fields.startDate === 'string' && typeof fields.endDate === 'string' && fields.endDate < fields.startDate) {
    reject('The period end must be on or after its start.')
  }
  return fields
}

function backendError(status: number, payload: unknown) {
  if (status === 401) return authError('Your session has expired. Sign in again.', 401)
  if (status === 403) return authError('Your account does not have permission to perform this payroll action.', 403)
  if ([400, 404, 409, 413, 415, 422, 429].includes(status)) {
    let message = 'The payroll request could not be completed.'
    if (isRecord(payload) && typeof payload.message === 'string' && payload.message.length <= 1000) {
      message = payload.message
    }
    return authError(message, status)
  }
  return authError('The payroll service could not complete this request. Please try again.', 502)
}

async function sessionToken() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  if (!token || !(await readVerifiedUser(token))) return null
  return token
}

type PayrollOperation = { path: () => string; body?: BodyKind }

export async function handlePayrollRequest(request: Request, operation: PayrollOperation) {
  if (request.method !== 'GET') {
    const rejected = checkSameOrigin(request)
    if (rejected) return rejected
  }
  try {
    const token = await sessionToken()
    if (!token) return authError('Sign in to continue.', 401)
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
      signal: AbortSignal.timeout(30_000)
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) return backendError(response.status, payload)
    if (!isRecord(payload) || payload.success !== true) {
      return authError('The payroll service returned an invalid response.', 502)
    }
    return authJson({ success: true, data: payload.data }, response.status)
  } catch (error) {
    if (error instanceof PayrollRequestError) return authError(error.message, error.status)
    return authError('The payroll service is currently unavailable. Please try again shortly.', 503)
  }
}

/** Proxies a server-rendered document (the payslip PDF) without buffering it into JSON. */
export async function handlePayrollDownload(request: Request, path: () => string) {
  try {
    const token = await sessionToken()
    if (!token) return authError('Sign in to continue.', 401)
    const response = await fetch(getBackendApiEndpoint(path()), {
      headers: { Accept: 'application/pdf', Authorization: `Bearer ${token}` },
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok) return backendError(response.status, await response.json().catch(() => null))
    const headers = new Headers({
      'Content-Type': response.headers.get('content-type') ?? 'application/pdf',
      'Cache-Control': 'no-store'
    })
    const disposition = response.headers.get('content-disposition')
    if (disposition) headers.set('Content-Disposition', disposition)
    return new Response(await response.arrayBuffer(), { status: 200, headers })
  } catch (error) {
    if (error instanceof PayrollRequestError) return authError(error.message, error.status)
    return authError('The payroll service is currently unavailable. Please try again shortly.', 503)
  }
}
