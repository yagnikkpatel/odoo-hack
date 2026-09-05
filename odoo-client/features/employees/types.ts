import type { Person } from '@/features/nexacrm/types/apps/person-types'

export type EmployeeStatus = 'active' | 'inactive'
export type EmploymentType = 'full-time' | 'part-time' | 'contract'

export type Employee = Pick<
  Person,
  | 'id'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'jobTitle'
  | 'avatar'
  | 'city'
  | 'country'
  | 'createdAt'
  | 'updatedAt'
  | 'createdById'
  | 'updatedById'
> & {
  companyId?: string
  department?: string
  managerId?: string
  status?: EmployeeStatus
  employmentType?: EmploymentType
}
export type EmployeeInput = Omit<
  Employee,
  'id' | 'createdAt' | 'updatedAt' | 'createdById' | 'updatedById'
>
export const EMPLOYEE_VIEW_TYPES = ['table', 'grid'] as const
export const STATUS_LABELS = { active: 'Active', inactive: 'Inactive' }
export const EMPLOYMENT_TYPE_LABELS = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
}
export const employeeName = (
  employee: Pick<Employee, 'firstName' | 'lastName'>,
) =>
  [employee.firstName, employee.lastName].filter(Boolean).join(' ') ||
  'Unnamed employee'

/** Identity-only preview seed. CRM relationships and activity are deliberately excluded. */
export function toEmployeePreview(person: Person): Employee {
  const {
    id,
    companyId,
    firstName,
    lastName,
    email,
    phone,
    jobTitle,
    avatar,
    city,
    country,
    createdAt,
    updatedAt,
    createdById,
    updatedById,
  } = person
  return {
    id,
    companyId,
    firstName,
    lastName,
    email,
    phone,
    jobTitle,
    avatar,
    city,
    country,
    createdAt,
    updatedAt,
    createdById,
    updatedById,
  }
}
export const EMPLOYEE_FIELD_LABELS: Record<keyof EmployeeInput, string> = {
  companyId: 'Company',
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Work email',
  phone: 'Phone',
  jobTitle: 'Job position',
  avatar: 'Photo',
  city: 'City',
  country: 'Country',
  department: 'Department',
  managerId: 'Manager',
  status: 'Status',
  employmentType: 'Employment type',
}
export type EmployeeChange = { label: string; value?: string }
export type EmployeeActivity = {
  id: string
  employeeId: string
  at: string
  actorId?: string
  verb: string
  subject: string
  changes?: EmployeeChange[]
}
