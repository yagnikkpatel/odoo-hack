import 'server-only'

import { cookies } from 'next/headers'
import { SESSION_COOKIE_NAME } from '@/features/auth/auth-constants'
import { authError, authJson, checkSameOrigin, readVerifiedUser } from '@/features/auth/auth-server'
import { isRecord } from '@/features/auth/auth-validation'
import { getBackendApiEndpoint } from '@/lib/backend-api'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_JSON_BYTES = 16_384
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_UPLOAD_BYTES = 2 * MAX_IMAGE_BYTES + 64 * 1024
const IMAGE_FIELDS = new Set(['employeeImage', 'companyImage'])
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const PROFILE_FIELDS: Record<string, number> = {
  jobPosition: 120,
  department: 120,
  contact: 20,
  workingSchedule: 60,
  companyName: 160,
  workLocation: 160,
  location: 160
}
const REQUIRED_PROFILE_FIELDS = ['jobPosition', 'department', 'contact', 'workingSchedule', 'companyName', 'workLocation', 'location']
const ROLE_NAMES = new Set(['admin', 'employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'])

class EmployeeRequestError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'EmployeeRequestError'
  }
}

export function employeePath(userId: string): string {
  if (!UUID_PATTERN.test(userId)) {
    throw new EmployeeRequestError(400, 'Choose a valid employee account.')
  }
  return `/employees/${userId}`
}

export function employeeImagePath(userId: string, imageType: string): string {
  if (imageType !== 'employee' && imageType !== 'company') {
    throw new EmployeeRequestError(400, 'Choose an employee or company image.')
  }
  return `${employeePath(userId)}/images/${imageType}`
}

export function employeeListPath(request: Request): string {
  const input = new URL(request.url).searchParams
  const output = new URLSearchParams()
  const allowed = new Set(['limit', 'offset', 'search', 'department', 'role'])

  for (const [key, rawValue] of input) {
    if (!allowed.has(key) || input.getAll(key).length !== 1) {
      throw new EmployeeRequestError(400, 'Unsupported or repeated employee filter.')
    }
    const value = rawValue.trim()
    if (key === 'limit' || key === 'offset') {
      const number = Number(value)
      let minimum = 0
      let maximum = 2_147_483_647
      if (key === 'limit') {
        minimum = 1
        maximum = 100
      }
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < minimum || number > maximum) {
        throw new EmployeeRequestError(400, `Invalid employee ${key}.`)
      }
    } else {
      if (!value || value.length > 120) {
        throw new EmployeeRequestError(400, `Enter a ${key} filter between 1 and 120 characters.`)
      }
      if (key === 'role' && !ROLE_NAMES.has(value)) {
        throw new EmployeeRequestError(400, 'Choose a valid employee role.')
      }
    }
    output.set(key, value)
  }

  const query = output.toString()
  if (!query) {
    return '/employees'
  }
  return `/employees?${query}`
}

async function readLimitedBody(request: Request, maximumBytes: number): Promise<Uint8Array> {
  if (Number(request.headers.get('content-length')) > maximumBytes) {
    throw new EmployeeRequestError(413, 'This request is too large.')
  }
  const reader = request.body?.getReader()
  if (!reader) {
    throw new EmployeeRequestError(400, 'Provide the request details.')
  }
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      totalBytes += value.byteLength
      if (totalBytes > maximumBytes) {
        await reader.cancel()
        throw new EmployeeRequestError(413, 'This request is too large.')
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks)
  } finally {
    reader.releaseLock()
  }
}

async function readProfileInput(request: Request): Promise<Record<string, string>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new EmployeeRequestError(415, 'Send employee details as JSON.')
  }
  const bytes = await readLimitedBody(request, MAX_JSON_BYTES)
  let input: unknown
  try {
    input = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new EmployeeRequestError(400, 'Employee details must be valid JSON.')
  }
  if (!isRecord(input) || Object.keys(input).length === 0) {
    throw new EmployeeRequestError(400, 'Provide at least one employee field.')
  }
  const fields: Record<string, string> = {}
  for (const [key, rawValue] of Object.entries(input)) {
    if (key === 'managerId') {
      if (typeof rawValue !== 'string' || !UUID_PATTERN.test(rawValue)) {
        throw new EmployeeRequestError(400, 'Choose a valid manager.')
      }
      fields.managerId = rawValue
      continue
    }
    if (!Object.hasOwn(PROFILE_FIELDS, key)) {
      throw new EmployeeRequestError(400, `The employee profile does not support the field ${key}.`)
    }
    if (typeof rawValue !== 'string' || !rawValue.trim() || rawValue.trim().length > PROFILE_FIELDS[key]) {
      throw new EmployeeRequestError(400, `Enter ${key} between 1 and ${PROFILE_FIELDS[key]} characters.`)
    }
    fields[key] = rawValue.trim()
  }
  const contact = fields.contact
  if (typeof contact === 'string' && (contact.length < 7 || !/^[0-9+()\-\s]+$/.test(contact))) {
    throw new EmployeeRequestError(400, 'Contact must contain 7 to 20 characters using digits, spaces, +, -, or parentheses.')
  }
  if (request.method === 'POST') {
    for (const key of REQUIRED_PROFILE_FIELDS) {
      if (!fields[key]) {
        throw new EmployeeRequestError(400, `The ${key} field is required.`)
      }
    }
    if (!fields.managerId) {
      throw new EmployeeRequestError(400, 'The manager field is required.')
    }
  }
  return fields
}

async function readImageUpload(request: Request): Promise<FormData> {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    throw new EmployeeRequestError(415, 'Send images as multipart form data.')
  }
  const bytes = await readLimitedBody(request, MAX_UPLOAD_BYTES)
  let input: FormData
  try {
    input = await new Response(Buffer.from(bytes), { headers: { 'Content-Type': contentType } }).formData()
  } catch {
    throw new EmployeeRequestError(400, 'The image upload could not be read.')
  }
  const output = new FormData()
  let count = 0
  for (const [key, value] of input) {
    if (!IMAGE_FIELDS.has(key) || input.getAll(key).length !== 1 || typeof value === 'string') {
      throw new EmployeeRequestError(400, 'Upload one employee image and/or one company image.')
    }
    if (value.size === 0 || value.size > MAX_IMAGE_BYTES) {
      throw new EmployeeRequestError(400, 'Each image must be nonempty and 5 MB or smaller.')
    }
    if (!IMAGE_TYPES.has(value.type)) {
      throw new EmployeeRequestError(400, 'Use JPEG, PNG, or WebP images.')
    }
    output.append(key, value, value.name)
    count += 1
  }
  if (count === 0) {
    throw new EmployeeRequestError(400, 'Choose an employee or company image to upload.')
  }
  return output
}

function backendError(status: number, payload: unknown) {
  if (status === 401) {
    return authError('Your session has expired. Sign in again.', 401)
  }
  if (status === 403) {
    return authError('Your account does not have permission to perform this employee action.', 403)
  }
  if ([400, 404, 409, 413, 415, 422, 429].includes(status)) {
    let message = 'The employee request could not be completed.'
    if (isRecord(payload) && typeof payload.message === 'string' && payload.message.length <= 1000) {
      message = payload.message
    }
    return authError(message, status)
  }
  return authError('The employee service could not complete this request. Please try again.', 502)
}

type EmployeeOperation = {
  path: () => string
  body?: 'profile' | 'images'
}

// The browser only receives employee data. The session token stays in the HttpOnly
// cookie and is forwarded solely to the configured backend over this server boundary.
export async function handleEmployeeRequest(request: Request, operation: EmployeeOperation) {
  if (request.method !== 'GET') {
    const rejected = checkSameOrigin(request)
    if (rejected) {
      return rejected
    }
  }
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
    if (!token || !(await readVerifiedUser(token))) {
      return authError('Sign in to continue.', 401)
    }
    const path = operation.path()
    const headers = new Headers({ Accept: 'application/json', Authorization: `Bearer ${token}` })
    let body: string | FormData | undefined
    let timeout = 15_000
    if (operation.body === 'profile') {
      body = JSON.stringify(await readProfileInput(request))
      headers.set('Content-Type', 'application/json')
    } else if (operation.body === 'images') {
      body = await readImageUpload(request)
      timeout = 30_000
    }
    const response = await fetch(getBackendApiEndpoint(path), {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(timeout)
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      return backendError(response.status, payload)
    }
    if (!isRecord(payload) || payload.success !== true) {
      return authError('The employee service returned an invalid response.', 502)
    }
    const result: Record<string, unknown> = { success: true }
    if (Object.hasOwn(payload, 'data')) {
      result.data = payload.data
    }
    if (typeof payload.message === 'string') {
      result.message = payload.message
    }
    return authJson(result, response.status)
  } catch (error) {
    if (error instanceof EmployeeRequestError) {
      return authError(error.message, error.status)
    }
    return authError('The employee service is currently unavailable. Please try again shortly.', 503)
  }
}
