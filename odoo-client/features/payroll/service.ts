import { ApiError } from '@/lib/api-client'
import {
  mapBankDetails,
  mapDashboard,
  mapEligibleEmployee,
  mapPayrun,
  mapPayrunDetail,
  mapPayslip,
  mapRule,
  mapSendResult,
  mapSnapshot,
  mapStructure,
  requirePayrollId,
  requireRecord
} from './mapper'
import type {
  BankDetails,
  BankDetailsInput,
  DashboardFilters,
  EligibleEmployee,
  PayrollDashboard,
  PayrollData,
  Payrun,
  PayrunDetail,
  PayrunInput,
  SalaryRule,
  SalaryRuleInput,
  SalaryStructure,
  SalaryStructureInput,
  SendPayslipsResult
} from './types'

async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')
  if (options.body) headers.set('Content-Type', 'application/json')
  const response = await fetch(`/api/payroll${path}`, {
    ...options,
    headers,
    credentials: 'same-origin',
    cache: 'no-store'
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    let message = 'Unable to complete the payroll request. Please try again.'
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
  if (result.success !== true) throw new ApiError('The payroll service returned an invalid response.', 502)
  return result.data
}
async function removed(path: string, id: string) {
  const data = requireRecord(await request(path, { method: 'DELETE' }))
  if (data.id !== id) throw new ApiError('The payroll service returned an invalid deletion.', 502)
}
const post = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })
const patch = (body: unknown) => ({ method: 'PATCH', body: JSON.stringify(body) })

export async function loadPayroll(signal?: AbortSignal): Promise<PayrollData> {
  return mapSnapshot(await request('', { signal }))
}
export async function listStructures(): Promise<SalaryStructure[]> {
  const data = requireRecord(await request('/structures'))
  if (!Array.isArray(data.structures)) throw new ApiError('The payroll service returned an invalid list.', 502)
  return data.structures.map(mapStructure)
}
export async function createRule(input: SalaryRuleInput): Promise<SalaryRule> {
  return mapRule(await request('/rules', post(input)))
}
export async function updateRule(id: string, input: SalaryRuleInput): Promise<SalaryRule> {
  return mapRule(await request(`/rules/${requirePayrollId(id)}`, patch(input)))
}
export async function deleteRule(id: string): Promise<void> {
  await removed(`/rules/${requirePayrollId(id)}`, id)
}
export async function createStructure(input: SalaryStructureInput): Promise<SalaryStructure> {
  return mapStructure(await request('/structures', post(input)))
}
export async function updateStructure(id: string, input: SalaryStructureInput): Promise<SalaryStructure> {
  return mapStructure(await request(`/structures/${requirePayrollId(id)}`, patch(input)))
}
export async function deleteStructure(id: string): Promise<void> {
  await removed(`/structures/${requirePayrollId(id)}`, id)
}
export async function listEligibleEmployees(
  structureId: string,
  startDate: string,
  endDate: string,
  signal?: AbortSignal
): Promise<EligibleEmployee[]> {
  const params = new URLSearchParams({ structureId: requirePayrollId(structureId), startDate, endDate })
  const data = requireRecord(await request(`/payruns/eligible?${params}`, { signal }))
  if (!Array.isArray(data.employees)) throw new ApiError('The payroll service returned an invalid list.', 502)
  return data.employees.map(mapEligibleEmployee)
}
export async function createPayrun(input: PayrunInput): Promise<Payrun> {
  return mapPayrun(await request('/payruns', post(input)))
}
export async function getPayrun(id: string): Promise<PayrunDetail> {
  return mapPayrunDetail(await request(`/payruns/${requirePayrollId(id)}`))
}
export async function computePayrun(id: string): Promise<PayrunDetail> {
  return mapPayrunDetail(await request(`/payruns/${requirePayrollId(id)}/compute`, { method: 'POST' }))
}
export async function validatePayrun(id: string): Promise<PayrunDetail> {
  return mapPayrunDetail(await request(`/payruns/${requirePayrollId(id)}/validate`, { method: 'POST' }))
}
export async function markPayrunPaid(id: string): Promise<PayrunDetail> {
  return mapPayrunDetail(await request(`/payruns/${requirePayrollId(id)}/mark-paid`, { method: 'POST' }))
}
export async function sendPayslips(id: string, payslipIds: string[]): Promise<SendPayslipsResult> {
  return mapSendResult(await request(`/payruns/${requirePayrollId(id)}/send`, post({ payslipIds })))
}
export async function deletePayrun(id: string): Promise<void> {
  await removed(`/payruns/${requirePayrollId(id)}`, id)
}
export async function deletePayslip(id: string): Promise<void> {
  await removed(`/payslips/${requirePayrollId(id)}`, id)
}
export async function getPayslip(id: string) {
  return mapPayslip(await request(`/payslips/${requirePayrollId(id)}`))
}
export async function getBankDetails(employeeId: string): Promise<BankDetails | null> {
  return mapBankDetails(await request(`/bank-details/${requirePayrollId(employeeId)}`))
}
export async function saveBankDetails(employeeId: string, input: BankDetailsInput): Promise<BankDetails> {
  const saved = mapBankDetails(await request(`/bank-details/${requirePayrollId(employeeId)}`, { method: 'PUT', body: JSON.stringify(input) }))
  if (!saved) throw new ApiError('The payroll service returned an invalid response.', 502)
  return saved
}
export async function loadDashboard(filters: DashboardFilters, signal?: AbortSignal): Promise<PayrollDashboard> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value)
  return mapDashboard(await request(`/dashboard?${params}`, { signal }))
}
/** Streams the server-rendered PDF and triggers a browser download. */
export async function downloadPayslipPdf(id: string, filename: string): Promise<void> {
  const response = await fetch(`/api/payroll/payslips/${requirePayrollId(id)}/pdf`, {
    credentials: 'same-origin',
    cache: 'no-store'
  })
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    const message =
      body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
        ? body.message
        : 'The payslip PDF could not be generated.'
    throw new ApiError(message, response.status)
  }
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
