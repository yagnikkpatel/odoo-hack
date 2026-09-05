export const USER_ROLES = ['employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager'] as const
export type UserRole = (typeof USER_ROLES)[number]

export type CreateUserInput = {
  name: string
  email: string
  password: string
  role: UserRole
}

export type CreatedUser = {
  id: string
  name: string
  email: string
  role: UserRole
  status: string
}

export const USER_ROLE_OPTIONS = [
  { value: 'employee', label: 'Employee' },
  { value: 'hr_manager', label: 'HR manager' },
  { value: 'hr_payroll_user', label: 'HR / payroll user' },
  { value: 'hr_payroll_manager', label: 'HR / payroll manager' }
]
