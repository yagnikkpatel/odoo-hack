import { ApiError } from '@/lib/api-client'
import { mapAccount, mapEmployee, mapEmployeeImages, mapPagination, mapSummary, requireEmployeeId, requireRecord } from './employee-mapper'
import type { EmployeeCreateInput, EmployeeImageType, EmployeeListQuery, EmployeeUpdateInput } from './types'

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch('/api/employees' + path, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store'
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    let message = 'Unable to complete the employee request. Please try again.'
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      message = body.message
    }
    if (response.status === 401) {
      message = 'Your session has expired. Sign in again.'
      if (typeof window !== 'undefined') {
        window.location.replace('/login')
      }
    }
    throw new ApiError(message, response.status)
  }
  const result = requireRecord(body)
  if (result.success !== true) {
    throw new ApiError('The employee service returned an invalid response.', 502)
  }
  return result.data
}

export async function listEmployees(query: EmployeeListQuery, signal?: AbortSignal) {
  const params = new URLSearchParams({ limit: String(query.limit), offset: String(query.offset) })
  for (const field of ['search', 'department', 'role'] as const) {
    const value = query[field]?.trim()
    if (value) {
      params.set(field, value)
    }
  }
  const data = requireRecord(await request('?' + params.toString(), { signal }))
  if (!Array.isArray(data.employees)) {
    throw new ApiError('The employee service returned an invalid list.', 502)
  }
  return {
    employees: data.employees.map(mapEmployee),
    pagination: mapPagination(data.pagination),
    summary: mapSummary(data.summary)
  }
}

export async function getEmployee(id: string) {
  return mapEmployee(await request('/' + requireEmployeeId(id)))
}

export async function createEmployee(input: EmployeeCreateInput) {
  const { userId, ...profile } = input
  return mapEmployee(await request('/' + requireEmployeeId(userId), { method: 'POST', body: JSON.stringify(profile) }))
}

export async function updateEmployee(id: string, profile: EmployeeUpdateInput) {
  return mapEmployee(await request('/' + requireEmployeeId(id), { method: 'PATCH', body: JSON.stringify(profile) }))
}

export async function deleteEmployee(id: string) {
  await request('/' + requireEmployeeId(id), { method: 'DELETE' })
}

export async function listEmployeeOptions(kind: 'accounts' | 'managers') {
  const data = await request('/' + kind)
  if (!Array.isArray(data)) {
    throw new ApiError('The employee service returned invalid options.', 502)
  }
  return data.map(mapAccount)
}

export async function uploadEmployeeImages(id: string, images: FormData) {
  const result = await request('/' + requireEmployeeId(id) + '/images', { method: 'POST', body: images })
  return mapEmployeeImages(result, id)
}

export async function deleteEmployeeImage(id: string, imageType: EmployeeImageType) {
  if (imageType !== 'employee' && imageType !== 'company') {
    throw new ApiError('Choose an employee photo or company logo.', 400)
  }
  const result = await request('/' + requireEmployeeId(id) + '/images/' + imageType, { method: 'DELETE' })
  return mapEmployeeImages(result, id)
}
