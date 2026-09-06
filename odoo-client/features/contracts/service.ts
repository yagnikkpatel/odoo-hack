import { listEmployees } from '@/features/employees/service'
import type { Employee } from '@/features/employees/types'
import { ApiError } from '@/lib/api-client'
import {
  mapContract,
  mapContractHistoryEntry,
  mapPagination,
  requireContractId,
  requireRecord,
} from './contract-mapper'
import type {
  Contract,
  ContractHistoryEntry,
  ContractInput,
  ContractListQuery,
  ContractUpdateInput,
} from './types'

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api/contracts${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    let message = 'Unable to complete the contract request. Please try again.'
    if (
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof body.message === 'string'
    ) {
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
    throw new ApiError('The contract service returned an invalid response.', 502)
  }
  return result.data
}

export async function listContracts(
  query: ContractListQuery,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    limit: String(query.limit),
    offset: String(query.offset),
  })
  for (const field of ['search', 'status', 'employeeId'] as const) {
    const value = query[field]?.trim()
    if (value) params.set(field, value)
  }
  const data = requireRecord(
    await request(`?${params.toString()}`, { signal }),
  )
  if (!Array.isArray(data.contracts)) {
    throw new ApiError('The contract service returned an invalid list.', 502)
  }
  return {
    contracts: data.contracts.map(mapContract),
    pagination: mapPagination(data.pagination),
  }
}

export async function getContract(id: string) {
  return mapContract(await request(`/${requireContractId(id)}`))
}

export async function createContract(input: ContractInput) {
  return mapContract(
    await request('', { method: 'POST', body: JSON.stringify(input) }),
  )
}

export async function updateContract(id: string, input: ContractUpdateInput) {
  return mapContract(
    await request(`/${requireContractId(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  )
}

export async function deleteContract(id: string) {
  await request(`/${requireContractId(id)}`, { method: 'DELETE' })
}

export async function getContractAuditLog(
  id: string,
): Promise<ContractHistoryEntry[]> {
  const data = await request(`/${requireContractId(id)}/history`)
  if (!Array.isArray(data)) {
    throw new ApiError('The contract service returned an invalid history list.', 502)
  }
  return data.map(mapContractHistoryEntry)
}

export async function getEmployeeContractAuditLog(
  employeeId: string,
): Promise<ContractHistoryEntry[]> {
  const data = await request(
    `/by-employee/${requireContractId(employeeId)}/history`,
  )
  if (!Array.isArray(data)) {
    throw new ApiError('The contract service returned an invalid history list.', 502)
  }
  return data.map(mapContractHistoryEntry)
}

export async function listEmployeeContracts(employeeId: string) {
  const contracts: Contract[] = []
  let offset = 0
  while (true) {
    const result = await listContracts({ limit: 100, offset, employeeId })
    contracts.push(...result.contracts)
    if (!result.pagination.hasMore || result.contracts.length === 0) break
    offset += result.contracts.length
  }
  return contracts
}

export async function listContractEmployees() {
  const employees: Employee[] = []
  let offset = 0
  while (true) {
    const result = await listEmployees({ limit: 100, offset })
    employees.push(...result.employees)
    if (!result.pagination.hasMore || result.employees.length === 0) break
    offset += result.employees.length
  }
  return employees
}
