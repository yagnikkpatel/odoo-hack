import { ApiError } from '@/lib/api-client'
import {
  mapDelivery,
  mapPayrollDashboard,
  mapDeliveryDispatch,
  mapEmployeeOption,
  mapPagination,
  mapPayrun,
  mapPayslip,
  mapSalaryRule,
  mapSalaryStructure,
  requirePayrollId,
  requireRecord,
} from './mapper'
import type {
  PayrollDashboardQuery,
  PayrollEmployeeOption,
  PayrunInput,
  SalaryRuleInput,
  SalaryStructureInput,
} from './types'

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api/payroll${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store',
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    let message = 'Unable to complete the payroll request. Please try again.'
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
    throw new ApiError('The payroll service returned an invalid response.', 502)
  }
  return result.data
}

function collection(data: unknown, field: string): unknown[] {
  const record = requireRecord(data)
  const items = record[field]
  if (!Array.isArray(items)) {
    throw new ApiError(`The payroll service returned an invalid ${field} list.`, 502)
  }
  return items
}

function search(params: URLSearchParams, value?: string) {
  const trimmed = value?.trim()
  if (trimmed) params.set('search', trimmed)
  return params
}

/**
 * Payroll configuration is small and every screen needs all of it at once --
 * a rule editor has to know the codes of every other rule, and a structure
 * lists its rules -- so these read the whole collection rather than a page.
 */
export async function listSalaryRules(signal?: AbortSignal) {
  const data = await request('/salary-rules?limit=200', { signal })
  return collection(data, 'rules').map(mapSalaryRule)
}

export async function createSalaryRule(input: SalaryRuleInput) {
  return mapSalaryRule(
    await request('/salary-rules', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  )
}

export async function updateSalaryRule(id: string, input: SalaryRuleInput) {
  return mapSalaryRule(
    await request(`/salary-rules/${requirePayrollId(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  )
}

export async function deleteSalaryRule(id: string) {
  await request(`/salary-rules/${requirePayrollId(id)}`, { method: 'DELETE' })
}

export async function listSalaryStructures(signal?: AbortSignal) {
  const data = await request('/salary-structures?limit=200', { signal })
  return collection(data, 'structures').map(mapSalaryStructure)
}

export async function createSalaryStructure(
  input: SalaryStructureInput,
  ruleSequences: { id: string; sequence: number }[] = [],
) {
  return mapSalaryStructure(
    await request('/salary-structures', {
      method: 'POST',
      body: JSON.stringify({ ...input, ruleSequences }),
    }),
  )
}

export async function updateSalaryStructure(
  id: string,
  input: SalaryStructureInput,
  ruleSequences: { id: string; sequence: number }[] = [],
) {
  return mapSalaryStructure(
    await request(`/salary-structures/${requirePayrollId(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ ...input, ruleSequences }),
    }),
  )
}

export async function deleteSalaryStructure(id: string) {
  await request(`/salary-structures/${requirePayrollId(id)}`, {
    method: 'DELETE',
  })
}

export async function listPayruns(
  query: { limit?: number; offset?: number; search?: string; status?: string } = {},
  signal?: AbortSignal,
) {
  const params = search(
    new URLSearchParams({
      limit: String(query.limit ?? 100),
      offset: String(query.offset ?? 0),
    }),
    query.search,
  )
  if (query.status && query.status !== 'all') params.set('status', query.status)
  const data = await request(`/payruns?${params.toString()}`, { signal })
  return {
    payruns: collection(data, 'payruns').map(mapPayrun),
    pagination: mapPagination(requireRecord(data).pagination),
  }
}

export async function getPayrun(id: string) {
  return mapPayrun(await request(`/payruns/${requirePayrollId(id)}`))
}

export async function createPayrun(input: PayrunInput) {
  return mapPayrun(
    await request('/payruns', { method: 'POST', body: JSON.stringify(input) }),
  )
}

export async function updatePayrun(id: string, input: PayrunInput) {
  return mapPayrun(
    await request(`/payruns/${requirePayrollId(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  )
}

export async function deletePayrun(id: string) {
  await request(`/payruns/${requirePayrollId(id)}`, { method: 'DELETE' })
}

async function payrunAction(id: string, action: string) {
  return mapPayrun(
    await request(`/payruns/${requirePayrollId(id)}/${action}`, {
      method: 'POST',
    }),
  )
}

export const computePayrun = (id: string) => payrunAction(id, 'compute')
export const validatePayrun = (id: string) => payrunAction(id, 'validate')
export const markPayrunPaid = (id: string) => payrunAction(id, 'mark-paid')

export async function listPayslips(
  query: {
    limit?: number
    offset?: number
    search?: string
    status?: string
    payrunId?: string
  } = {},
  signal?: AbortSignal,
) {
  const params = search(
    new URLSearchParams({
      limit: String(query.limit ?? 200),
      offset: String(query.offset ?? 0),
    }),
    query.search,
  )
  if (query.status && query.status !== 'all') params.set('status', query.status)
  if (query.payrunId) params.set('payrunId', requirePayrollId(query.payrunId))
  const data = await request(`/payslips?${params.toString()}`, { signal })
  return {
    payslips: collection(data, 'payslips').map(mapPayslip),
    pagination: mapPagination(requireRecord(data).pagination),
  }
}

export async function getPayslip(id: string) {
  return mapPayslip(await request(`/payslips/${requirePayrollId(id)}`))
}

/** Resolves to the payrun the deleted payslip belonged to. */
export async function deletePayslip(id: string) {
  const data = requireRecord(
    await request(`/payslips/${requirePayrollId(id)}`, { method: 'DELETE' }),
  )
  return requirePayrollId(data.payrunId)
}

export async function listEligibleEmployees(
  startDate: string,
  endDate: string,
  signal?: AbortSignal,
): Promise<PayrollEmployeeOption[]> {
  const params = new URLSearchParams({ startDate, endDate, limit: '500' })
  const data = await request(`/eligible-employees?${params.toString()}`, {
    signal,
  })
  return collection(data, 'employees').map(mapEmployeeOption)
}

export async function setBankAccount(employeeId: string, accountNumber: string) {
  await request(`/bank-accounts/${requirePayrollId(employeeId)}`, {
    method: 'PUT',
    body: JSON.stringify({ accountNumber }),
  })
}

/**
 * Hands a payrun to the delivery queue. With no payslipIds every payslip in the
 * payrun is sent; recipients replaces the stored address for the employees
 * whose payslip carries a wrong or missing one. The response describes what was
 * queued -- the mail itself is sent by the worker afterwards.
 */
export async function sendPayrunPayslips(
  payrunId: string,
  options: {
    payslipIds?: string[]
    recipients?: { payslipId: string; email: string }[]
  } = {},
) {
  const body: Record<string, unknown> = {}
  if (options.payslipIds?.length) {
    body.payslipIds = options.payslipIds.map(requirePayrollId)
  }
  if (options.recipients?.length) {
    body.recipients = options.recipients.map(entry => ({
      payslipId: requirePayrollId(entry.payslipId),
      email: entry.email.trim(),
    }))
  }
  return mapDeliveryDispatch(
    await request(`/payruns/${requirePayrollId(payrunId)}/send-payslips`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

/** One payslip, optionally to an address other than the one on the record. */
export async function sendPayslip(payslipId: string, email?: string) {
  const trimmed = email?.trim()
  return mapDeliveryDispatch(
    await request(`/payslips/${requirePayrollId(payslipId)}/send`, {
      method: 'POST',
      body: JSON.stringify(trimmed ? { email: trimmed } : {}),
    }),
  )
}

export async function listPayrunDeliveries(
  payrunId: string,
  signal?: AbortSignal,
) {
  const data = await request(
    `/payruns/${requirePayrollId(payrunId)}/deliveries`,
    { signal },
  )
  return collection(data, 'deliveries').map(mapDelivery)
}

/**
 * The payroll dashboard for one period. The API aggregates payroll, attendance
 * and time off together, so this is one request rather than the four module
 * reads the screen would otherwise have to fold together itself.
 */
export async function getPayrollDashboard(
  query: PayrollDashboardQuery,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    startDate: query.startDate,
    endDate: query.endDate,
    currency: query.currency,
  })
  if (query.department) params.set('department', query.department)
  if (query.jobPosition) params.set('jobPosition', query.jobPosition)
  return mapPayrollDashboard(
    await request(`/dashboard?${params.toString()}`, { signal }),
  )
}
