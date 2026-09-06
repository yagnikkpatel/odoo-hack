import { BACKEND_ROLES } from '@/features/auth/auth-types'
import { ApiError } from '@/lib/api-client'
import type { Employee, EmployeeAccount, EmployeePagination, EmployeeSummary } from './types'

export function requireRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('The employee service returned an invalid response.', 502)
  }
  return value as Record<string, unknown>
}

function text(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }
  return ''
}

function optionalText(value: unknown): string | undefined {
  const result = text(value)
  if (result) {
    return result
  }
  return undefined
}

function count(value: unknown): number {
  if (value === null || value === undefined) {
    return 0
  }
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new ApiError('The employee service returned an invalid count.', 502)
  }
  return value
}

export function requireEmployeeId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test(value)) {
    throw new ApiError('A valid employee account ID is required.', 400)
  }
  return value
}

function imageUrl(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  const image = requireRecord(value)
  const source = text(image.imageUrl)
  if (!source) {
    return undefined
  }
  try {
    const url = new URL(source)
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return url.href
    }
  } catch {
    return undefined
  }
  return undefined
}

/** Keep API field names at this boundary; existing HR components use name aliases. */
export function mapEmployee(value: unknown): Employee {
  const record = requireRecord(value)
  const name = text(record.name)
  const names = name.split(/\s+/)
  const firstName = names.shift() || ''
  const employee: Employee = {
    id: requireEmployeeId(record.userId),
    name,
    firstName,
    lastName: names.join(' '),
    email: text(record.email),
    phone: optionalText(record.contact),
    jobTitle: optionalText(record.jobPosition),
    avatar: imageUrl(record.employeeImage),
    companyImage: imageUrl(record.companyImage),
    companyName: optionalText(record.company),
    department: optionalText(record.department),
    managerId: optionalText(record.managerId),
    managerName: optionalText(record.managerName),
    workingSchedule: optionalText(record.workingSchedule),
    workLocation: optionalText(record.workLocation),
    location: optionalText(record.location),
    workLatitude: typeof record.workLatitude === 'number' ? record.workLatitude : null,
    workLongitude: typeof record.workLongitude === 'number' ? record.workLongitude : null,
    workRadiusM: typeof record.workRadiusM === 'number' ? record.workRadiusM : undefined,
    createdAt: text(record.createdAt),
    updatedAt: text(record.updatedAt)
  }
  if (record.status === 'active' || record.status === 'inactive') {
    employee.status = record.status
  }
  for (const role of BACKEND_ROLES) {
    if (record.role === role) {
      employee.role = role
      break
    }
  }
  return employee
}

export function mapPagination(value: unknown): EmployeePagination {
  const record = requireRecord(value)
  const limit = count(record.limit)
  if (limit < 1 || limit > 100 || typeof record.hasMore !== 'boolean') {
    throw new ApiError('The employee service returned invalid pagination.', 502)
  }
  return { total: count(record.total), limit, offset: count(record.offset), hasMore: record.hasMore }
}

export function mapSummary(value: unknown): EmployeeSummary {
  const record = requireRecord(value)
  return {
    total: count(record.total),
    active: count(record.active),
    departments: count(record.departments),
    locations: count(record.locations),
    withManager: count(record.withManager),
    withoutManager: count(record.withoutManager)
  }
}

export function mapAccount(value: unknown): EmployeeAccount {
  const record = requireRecord(value)
  return {
    id: requireEmployeeId(record.id),
    name: text(record.name),
    email: text(record.email),
    role: text(record.role),
    status: optionalText(record.status)
  }
}

export function mapEmployeeImages(value: unknown, expectedId: string) {
  const record = requireRecord(value)
  if (record.userId !== expectedId) {
    throw new ApiError('The employee service returned images for an unexpected account.', 502)
  }
  return {
    avatar: imageUrl(record.employeeImage),
    companyImage: imageUrl(record.companyImage)
  }
}
