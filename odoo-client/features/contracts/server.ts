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
const MAX_JSON_BYTES = 16_384
const CONTRACT_STATUSES = new Set(['running', 'expired'])

class ContractRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ContractRequestError'
  }
}

export function contractPath(id: string) {
  if (!UUID_PATTERN.test(id)) {
    throw new ContractRequestError(400, 'Choose a valid contract.')
  }
  return `/contracts/${id}`
}

export function contractListPath(request: Request) {
  const input = new URL(request.url).searchParams
  const output = new URLSearchParams()
  const allowed = new Set([
    'limit',
    'offset',
    'search',
    'status',
    'employeeId',
  ])

  for (const [key, rawValue] of input) {
    if (!allowed.has(key) || input.getAll(key).length !== 1) {
      throw new ContractRequestError(
        400,
        'Unsupported or repeated contract filter.',
      )
    }
    const value = rawValue.trim()
    if (key === 'limit' || key === 'offset') {
      const number = Number(value)
      const minimum = key === 'limit' ? 1 : 0
      const maximum = key === 'limit' ? 100 : 2_147_483_647
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(number) ||
        number < minimum ||
        number > maximum
      ) {
        throw new ContractRequestError(400, `Invalid contract ${key}.`)
      }
    } else if (key === 'status') {
      if (!CONTRACT_STATUSES.has(value)) {
        throw new ContractRequestError(400, 'Choose a valid contract status.')
      }
    } else if (key === 'employeeId') {
      if (!UUID_PATTERN.test(value)) {
        throw new ContractRequestError(400, 'Choose a valid employee.')
      }
    } else if (!value || value.length > 120) {
      throw new ContractRequestError(
        400,
        'Enter a contract search between 1 and 120 characters.',
      )
    }
    output.set(key, value)
  }

  const query = output.toString()
  return query ? `/contracts?${query}` : '/contracts'
}

async function readLimitedBody(request: Request) {
  if (Number(request.headers.get('content-length')) > MAX_JSON_BYTES) {
    throw new ContractRequestError(413, 'This request is too large.')
  }
  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength > MAX_JSON_BYTES) {
    throw new ContractRequestError(413, 'This request is too large.')
  }
  return new TextDecoder().decode(bytes)
}

async function readContractInput(
  request: Request,
  kind: 'create' | 'update',
) {
  if (
    !request.headers
      .get('content-type')
      ?.toLowerCase()
      .startsWith('application/json')
  ) {
    throw new ContractRequestError(415, 'Send contract details as JSON.')
  }
  let input: unknown
  try {
    input = JSON.parse(await readLimitedBody(request))
  } catch (error) {
    if (error instanceof ContractRequestError) throw error
    throw new ContractRequestError(400, 'Contract details must be valid JSON.')
  }
  if (!isRecord(input)) {
    throw new ContractRequestError(400, 'Provide the contract details.')
  }

  const allowed =
    kind === 'create'
      ? new Set(['employeeId', 'startDate', 'endDate', 'wage', 'status'])
      : new Set(['startDate', 'endDate', 'wage', 'status'])
  const required =
    kind === 'create'
      ? ['employeeId', 'startDate', 'endDate', 'wage']
      : []
  const fields: Record<string, string | number> = {}

  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) {
      throw new ContractRequestError(
        400,
        `The contract does not support the field ${key}.`,
      )
    }
    if (key === 'employeeId') {
      if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
        throw new ContractRequestError(400, 'Choose a valid employee.')
      }
    } else if (key === 'startDate' || key === 'endDate') {
      if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
        throw new ContractRequestError(400, `Enter a valid ${key}.`)
      }
    } else if (key === 'wage') {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value <= 0 ||
        value > 9_999_999_999.99
      ) {
        throw new ContractRequestError(400, 'Enter a valid positive wage.')
      }
    } else if (typeof value !== 'string' || !CONTRACT_STATUSES.has(value)) {
      throw new ContractRequestError(400, 'Choose a valid contract status.')
    }
    fields[key] = value as string | number
  }

  for (const key of required) {
    if (!Object.hasOwn(fields, key)) {
      throw new ContractRequestError(400, `The ${key} field is required.`)
    }
  }
  if (kind === 'update' && Object.keys(fields).length === 0) {
    throw new ContractRequestError(400, 'Provide at least one contract field.')
  }
  return fields
}

function backendError(status: number, payload: unknown) {
  if (status === 401) {
    return authError('Your session has expired. Sign in again.', 401)
  }
  if (status === 403) {
    return authError(
      'Your account does not have permission to perform this contract action.',
      403,
    )
  }
  if ([400, 404, 409, 413, 415, 422, 429].includes(status)) {
    let message = 'The contract request could not be completed.'
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
    'The contract service could not complete this request. Please try again.',
    502,
  )
}

type ContractOperation = {
  path: () => string
  body?: 'create' | 'update'
}

export async function handleContractRequest(
  request: Request,
  operation: ContractOperation,
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
      body = JSON.stringify(await readContractInput(request, operation.body))
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
      return authError('The contract service returned an invalid response.', 502)
    }
    const result: Record<string, unknown> = { success: true }
    if (Object.hasOwn(payload, 'data')) result.data = payload.data
    return authJson(result, response.status)
  } catch (error) {
    if (error instanceof ContractRequestError) {
      return authError(error.message, error.status)
    }
    return authError(
      'The contract service is currently unavailable. Please try again shortly.',
      503,
    )
  }
}
