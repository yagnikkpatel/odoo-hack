import { ApiError } from '@/lib/api-client'
import { listEmployeeDirectory, type EmployeeOption } from '@/features/hr/employee-options'
import {
  mapAttendance,
  mapPagination,
  requireAttendanceId,
  requireRecord,
} from './attendance-mapper'
import type {
  AttendanceInput,
  AttendanceListQuery,
  AttendanceListResult,
  AttendanceUpdateInput,
} from './types'

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api/attendance${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    let message = 'Unable to complete the attendance request. Please try again.'
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      message = body.message
    }
    if (response.status === 401) {
      message = 'Your session has expired. Sign in again.'
      if (typeof window !== 'undefined') window.location.replace('/login')
    }
    throw new ApiError(message, response.status)
  }
  const result = requireRecord(body)
  if (result.success !== true) {
    throw new ApiError('The attendance service returned an invalid response.', 502)
  }
  return result.data
}
export async function listAttendances(
  query: AttendanceListQuery,
  signal?: AbortSignal,
): Promise<AttendanceListResult> {
  const own = query.scope === 'own'
  if (own && (query.employeeId || query.search)) {
    throw new ApiError('Personal attendance does not support employee filters.', 400)
  }
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
  })
  for (const field of ['status', 'employeeId', 'search', 'from', 'to'] as const) {
    const value = query[field]?.trim()
    if (value) params.set(field, value)
  }
  const data = requireRecord(await request(`${own ? '/me' : ''}?${params}`, { signal }))
  if (!Array.isArray(data.attendances)) {
    throw new ApiError('The attendance service returned an invalid list.', 502)
  }
  return {
    attendances: data.attendances.map(mapAttendance),
    pagination: mapPagination(data.pagination),
  }
}

export async function getAttendance(id: string) {
  return mapAttendance(await request(`/${requireAttendanceId(id)}`))
}

export async function getMyTodayAttendance() {
  const value = await request('/me/today')
  return value === null ? null : mapAttendance(value)
}

export async function checkIn() {
  return mapAttendance(await request('/check-in', { method: 'POST' }))
}

export async function checkOut() {
  return mapAttendance(await request('/check-out', { method: 'POST' }))
}

export async function createAttendance(input: AttendanceInput) {
  return mapAttendance(
    await request('', { method: 'POST', body: JSON.stringify(input) }),
  )
}

export async function updateAttendance(id: string, input: AttendanceUpdateInput) {
  return mapAttendance(
    await request(`/${requireAttendanceId(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  )
}

export async function deleteAttendance(id: string) {
  const data = requireRecord(
    await request(`/${requireAttendanceId(id)}`, { method: 'DELETE' }),
  )
  if (data.id !== id) {
    throw new ApiError('The attendance service returned an invalid deletion.', 502)
  }
}

export type AttendanceEmployee = EmployeeOption

export const listAttendanceEmployees = listEmployeeDirectory
