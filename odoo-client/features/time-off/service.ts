import { ApiError } from '@/lib/api-client'
import {
  mapAllocation,
  mapRequest,
  mapSnapshot,
  mapTimeOffType,
  requireRecord,
  requireTimeOffId,
} from './mapper'
import type {
  Allocation,
  AllocationInput,
  RequestInput,
  TimeOffData,
  TimeOffRequest,
  TimeOffType,
  TimeOffTypeInput,
} from './model'

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api/time-off${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    let message = 'Unable to complete the time off request. Please try again.'
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
    throw new ApiError('The time off service returned an invalid response.', 502)
  }
  return result.data
}

async function removed(path: string, id: string) {
  const data = requireRecord(await request(path, { method: 'DELETE' }))
  if (data.id !== id) {
    throw new ApiError('The time off service returned an invalid deletion.', 502)
  }
}

export async function loadTimeOff(signal?: AbortSignal): Promise<TimeOffData> {
  return mapSnapshot(await request('', { signal }))
}

export async function loadMyTimeOff(signal?: AbortSignal): Promise<TimeOffData> {
  return mapSnapshot(await request('/me', { signal }))
}

export async function createType(input: TimeOffTypeInput): Promise<TimeOffType> {
  return mapTimeOffType(await request('/types', { method: 'POST', body: JSON.stringify(input) }))
}

export async function updateType(id: string, input: TimeOffTypeInput): Promise<TimeOffType> {
  return mapTimeOffType(
    await request(`/types/${requireTimeOffId(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  )
}

export async function deleteType(id: string): Promise<void> {
  await removed(`/types/${requireTimeOffId(id)}`, id)
}

export async function createAllocation(input: AllocationInput): Promise<Allocation> {
  return mapAllocation(
    await request('/allocations', { method: 'POST', body: JSON.stringify(input) }),
  )
}

export async function updateAllocation(id: string, input: AllocationInput): Promise<Allocation> {
  return mapAllocation(
    await request(`/allocations/${requireTimeOffId(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  )
}

export async function approveAllocation(id: string): Promise<Allocation> {
  return mapAllocation(
    await request(`/allocations/${requireTimeOffId(id)}/approve`, { method: 'POST' }),
  )
}

export async function refuseAllocation(id: string, reason: string): Promise<Allocation> {
  return mapAllocation(
    await request(`/allocations/${requireTimeOffId(id)}/refuse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  )
}

export async function deleteAllocation(id: string): Promise<void> {
  await removed(`/allocations/${requireTimeOffId(id)}`, id)
}

export async function createRequest(input: RequestInput): Promise<TimeOffRequest> {
  return mapRequest(await request('/requests', { method: 'POST', body: JSON.stringify(input) }))
}

export async function updateRequest(id: string, input: RequestInput): Promise<TimeOffRequest> {
  return mapRequest(
    await request(`/requests/${requireTimeOffId(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  )
}

export async function approveRequest(id: string): Promise<TimeOffRequest> {
  return mapRequest(await request(`/requests/${requireTimeOffId(id)}/approve`, { method: 'POST' }))
}

export async function refuseRequest(id: string, reason: string): Promise<TimeOffRequest> {
  return mapRequest(
    await request(`/requests/${requireTimeOffId(id)}/refuse`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  )
}

export async function cancelRequest(id: string, reason: string): Promise<TimeOffRequest> {
  return mapRequest(
    await request(`/requests/${requireTimeOffId(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  )
}

export async function deleteRequest(id: string): Promise<void> {
  await removed(`/requests/${requireTimeOffId(id)}`, id)
}
