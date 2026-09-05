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
const STATUSES = new Set(['present', 'absent', 'incomplete'])
const MAX_BYTES = 16_384

class AttendanceRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

function reject(message: string): never {
  throw new AttendanceRequestError(400, message)
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function validTimestamp(value: unknown): value is string {
  const pattern = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/
  if (typeof value !== 'string' || !pattern.test(value)) return false
  return validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value))
}

export function attendancePath(id: string) {
  if (!UUID.test(id)) reject('Choose a valid attendance record.')
  return `/attendance/${id}`
}

export function attendanceListPath(request: Request, own = false) {
  const input = new URL(request.url).searchParams
  const output = new URLSearchParams()
  const allowed = new Set(['limit', 'offset', 'status', 'from', 'to'])
  if (!own) {
    allowed.add('employeeId')
    allowed.add('search')
  }
  for (const [key, raw] of input) {
    if (!allowed.has(key) || input.getAll(key).length !== 1) {
      reject('Unsupported or repeated attendance filter.')
    }
    const value = raw.trim()
    if (key === 'limit' || key === 'offset') {
      const number = Number(value)
      const minimum = key === 'limit' ? 1 : 0
      const maximum = key === 'limit' ? 100 : 2_147_483_647
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < minimum || number > maximum) {
        reject(`Invalid attendance ${key}.`)
      }
    } else if (key === 'status') {
      if (!STATUSES.has(value)) reject('Choose a valid attendance status.')
    } else if (key === 'employeeId') {
      if (!UUID.test(value)) reject('Choose a valid employee.')
    } else if (key === 'from' || key === 'to') {
      if (!validDate(value)) reject('Enter a valid attendance date.')
    } else if (!value || value.length > 120) {
      reject('Enter a search between 1 and 120 characters.')
    }
    output.set(key, value)
  }
  const from = output.get('from')
  const to = output.get('to')
  if (from && to && to < from) {
    reject('The end date must be on or after the start date.')
  }
  const path = own ? '/attendance/me' : '/attendance'
  return output.size ? `${path}?${output}` : path
}
async function readInput(request: Request, kind: 'create' | 'update') {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new AttendanceRequestError(415, 'Send attendance details as JSON.')
  }
  if (Number(request.headers.get('content-length')) > MAX_BYTES) {
    throw new AttendanceRequestError(413, 'This request is too large.')
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) throw new AttendanceRequestError(413, 'This request is too large.')
  let input: unknown
  try {
    input = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    reject('Attendance details must be valid JSON.')
  }
  if (!isRecord(input)) reject('Provide attendance details.')
  const allowed = new Set(['checkIn', 'checkOut', 'overtimeHours', 'status', 'editReason'])
  if (kind === 'create') {
    allowed.add('employeeId')
    allowed.add('attendanceDate')
  }
  const fields: Record<string, string | number | null> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) reject(`Attendance does not support the field ${key}.`)
    if (key === 'employeeId') {
      if (typeof value !== 'string' || !UUID.test(value)) reject('Choose a valid employee.')
    } else if (key === 'attendanceDate') {
      if (!validDate(value)) reject('Enter a valid attendance date.')
    } else if (key === 'checkIn' || key === 'checkOut') {
      const clearingTimestamp = kind === 'update' && value === null
      if (!clearingTimestamp && !validTimestamp(value)) {
        reject('Enter a timestamp with a timezone.')
      }
    } else if (key === 'overtimeHours') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 24) {
        reject('Overtime must be between 0 and 24 hours.')
      }
    } else if (key === 'status') {
      if (typeof value !== 'string' || !STATUSES.has(value)) reject('Choose a valid attendance status.')
    } else if (typeof value !== 'string' || !value.trim() || value.trim().length > 500) {
      reject('Enter an edit reason between 1 and 500 characters.')
    }
    fields[key] = key === 'editReason'
      ? (value as string).trim()
      : value as string | number | null
  }
  if (kind === 'create') {
    if (!fields.employeeId || !fields.attendanceDate) reject('Employee and attendance date are required.')
    if (fields.checkOut && !fields.checkIn) reject('Check-out requires check-in.')
    const { checkIn, checkOut } = fields
    if (typeof checkIn === 'string' && typeof checkOut === 'string' && Date.parse(checkOut) <= Date.parse(checkIn)) {
      reject('Check-out must be after check-in.')
    }
  } else if (!Object.keys(fields).length) reject('Provide at least one attendance field.')
  return fields
}
function backendError(status: number, payload: unknown) {
  if (status === 401) return authError('Your session has expired. Sign in again.', 401)
  if (status === 403) {
    return authError('Your account does not have permission to perform this attendance action.', 403)
  }
  if ([400, 404, 409, 413, 415, 422, 429].includes(status)) {
    let message = 'The attendance request could not be completed.'
    if (isRecord(payload) && typeof payload.message === 'string' && payload.message.length <= 1000) {
      message = payload.message
    }
    return authError(message, status)
  }
  return authError('The attendance service could not complete this request. Please try again.', 502)
}
type AttendanceOperation = { path: () => string; body?: 'create' | 'update' }

export async function handleAttendanceRequest(request: Request, operation: AttendanceOperation) {
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
      return authError('The attendance service returned an invalid response.', 502)
    }
    return authJson({ success: true, data: payload.data }, response.status)
  } catch (error) {
    if (error instanceof AttendanceRequestError) return authError(error.message, error.status)
    return authError('The attendance service is currently unavailable. Please try again shortly.', 503)
  }
}
