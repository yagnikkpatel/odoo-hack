import type { BackendRole } from '@/features/auth/auth-types'

export type EmployeeStatus = 'active' | 'inactive'
export type EmploymentType = 'full-time' | 'part-time' | 'contract'

/** The employee ID is the backend userId, never a generated frontend ID. */
export type Employee = {
  id: string
  name?: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  jobTitle?: string
  avatar?: string
  companyImage?: string
  companyName?: string
  department?: string
  managerId?: string
  managerName?: string
  workingSchedule?: string
  workLocation?: string
  location?: string
  role?: BackendRole
  status?: EmployeeStatus
  createdAt: string
  updatedAt: string
  // Other HR modules consume these optional fields. This API does not supply
  // them, so the employee mapper deliberately leaves them unset.
  companyId?: string
  employmentType?: EmploymentType
  city?: string
  country?: string
  createdById?: string
  updatedById?: string
}

export type EmployeeProfileInput = {
  jobPosition: string
  department: string
  contact: string
  workingSchedule: string
  companyName: string
  workLocation: string
  managerId?: string | null
  location?: string | null
}
export type EmployeeCreateInput = EmployeeProfileInput & { userId: string }
export type EmployeeUpdateInput = Partial<EmployeeProfileInput>
export type EmployeeListQuery = {
  limit: number
  offset: number
  search?: string
  department?: string
  role?: string
}
export type EmployeePagination = { total: number; limit: number; offset: number; hasMore: boolean }
export type EmployeeSummary = {
  total: number
  active: number
  departments: number
  locations: number
  withManager: number
  withoutManager: number
}
export type EmployeeAccount = { id: string; name: string; email: string; role: string; status?: string }
export type EmployeeManager = EmployeeAccount
export type EmployeeImageType = 'employee' | 'company'

export const EMPLOYEE_VIEW_TYPES = ['table', 'grid'] as const
export const STATUS_LABELS = { active: 'Active', inactive: 'Inactive' }
export const EMPLOYMENT_TYPE_LABELS = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract'
}
export function employeeName(employee: Pick<Employee, 'firstName' | 'lastName'> & { name?: string }) {
  if (employee.name?.trim()) {
    return employee.name.trim()
  }
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim()
  if (name) {
    return name
  }
  return 'Unnamed employee'
}
export function emptyEmployeeSummary(): EmployeeSummary {
  return { total: 0, active: 0, departments: 0, locations: 0, withManager: 0, withoutManager: 0 }
}
