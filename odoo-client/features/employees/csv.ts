import { downloadCsv } from '@/features/nexacrm/utils/csv'
import { ROLE_LABELS } from '@/features/nexacrm/types/rbac-types'
import { STATUS_LABELS, employeeName } from './types'
import type { Employee } from './types'

// Prevent spreadsheet applications from evaluating user-supplied formulas.
function safeCell(value: string | undefined) {
  if (!value) return 'Not set'
  if (/^\s*[=+\-@]/.test(value)) return "'" + value
  return value
}

export function employeeCsvRows(employees: readonly Employee[]) {
  return employees.map((employee) => {
    let status = 'Not set'
    let role = 'Not set'
    if (employee.status) status = STATUS_LABELS[employee.status]
    if (employee.role) role = ROLE_LABELS[employee.role]

    return {
      'Employee ID': safeCell(employee.id),
      Name: safeCell(employeeName(employee)),
      'Work email': safeCell(employee.email),
      'Job position': safeCell(employee.jobTitle),
      Department: safeCell(employee.department),
      Company: safeCell(employee.companyName),
      Manager: safeCell(employee.managerName),
      Role: role,
      Status: status,
      Phone: safeCell(employee.phone),
      Location: safeCell(employee.location),
      'Work location': safeCell(employee.workLocation),
    }
  })
}

export function downloadEmployeesCsv(
  employees: readonly Employee[],
  filename = 'employees-current-page.csv',
) {
  downloadCsv(filename, employeeCsvRows(employees))
}
