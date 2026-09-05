import type {
  ImportField,
  ParsedRow,
} from '@/features/nexacrm/components/data-table/import-dialog'
import { downloadCsv } from '@/features/nexacrm/utils/csv'
import { splitPersonName } from '@/features/nexacrm/types/apps/person-types'
import { EMPLOYMENT_TYPE_LABELS, STATUS_LABELS, employeeName } from './types'
import type {
  Employee,
  EmployeeInput,
  EmployeeStatus,
  EmploymentType,
} from './types'

export const EMPLOYEE_IMPORT_FIELDS: ImportField[] = [
  { key: 'name', label: 'Name', aliases: ['full name', 'employee'] },
  { key: 'firstName', label: 'First name', aliases: ['given name'] },
  { key: 'lastName', label: 'Last name', aliases: ['surname'] },
  { key: 'email', label: 'Work email', aliases: ['email', 'email address'] },
  {
    key: 'jobTitle',
    label: 'Job position',
    aliases: ['job title', 'position'],
  },
  { key: 'department', label: 'Department' },
  { key: 'managerId', label: 'Manager ID' },
  { key: 'status', label: 'Status' },
  { key: 'employmentType', label: 'Employment type' },
  { key: 'phone', label: 'Phone', aliases: ['phone number'] },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
]
export const createEmployeeRowParser =
  (employees: Employee[]) =>
  (values: Record<string, string>): ParsedRow<EmployeeInput> => {
    const row = Object.fromEntries(
      EMPLOYEE_IMPORT_FIELDS.map((field) => [
        field.key,
        (values[field.key] ?? '').trim(),
      ]),
    )
    if (!row.name && !row.firstName && !row.lastName)
      return { ok: false, error: 'A name is required' }
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
      return { ok: false, error: 'Work email is not valid' }
    const status = row.status.toLowerCase()
    const employmentType = row.employmentType.toLowerCase().replaceAll(' ', '-')
    if (status && !Object.hasOwn(STATUS_LABELS, status))
      return { ok: false, error: 'Status must be Active or Inactive' }
    if (
      employmentType &&
      !Object.hasOwn(EMPLOYMENT_TYPE_LABELS, employmentType)
    ) {
      return {
        ok: false,
        error: 'Employment type must be Full-time, Part-time or Contract',
      }
    }
    if (
      row.managerId &&
      !employees.some((employee) => employee.id === row.managerId)
    ) {
      return { ok: false, error: 'Manager ID must match an existing employee' }
    }
    const name =
      row.firstName || row.lastName
        ? { firstName: row.firstName, lastName: row.lastName }
        : splitPersonName(row.name)
    return {
      ok: true,
      input: {
        ...name,
        email: row.email,
        jobTitle: row.jobTitle || undefined,
        department: row.department || undefined,
        managerId: row.managerId || undefined,
        status: (status as EmployeeStatus) || undefined,
        employmentType: (employmentType as EmploymentType) || undefined,
        phone: row.phone || undefined,
        city: row.city || undefined,
        country: row.country || undefined,
      },
    }
  }

// Guard spreadsheet formula execution when a user opens an exported CSV.
const safeCell = (value: string | undefined) =>
  value && /^[\s]*[=+\-@]/.test(value) ? "'" + value : value
export const employeeCsvRows = (employees: Employee[]) =>
  employees.map((employee) => ({
    'Employee ID': employee.id,
    Name: safeCell(employeeName(employee)),
    'Work email': safeCell(employee.email),
    'Job position': safeCell(employee.jobTitle),
    Department: safeCell(employee.department),
    'Manager ID': employee.managerId,
    Status: employee.status ? STATUS_LABELS[employee.status] : '',
    'Employment type': employee.employmentType
      ? EMPLOYMENT_TYPE_LABELS[employee.employmentType]
      : '',
    Phone: safeCell(employee.phone),
    City: safeCell(employee.city),
    Country: safeCell(employee.country),
  }))
export const downloadEmployeesCsv = (employees: Employee[]) =>
  downloadCsv('employees.csv', employeeCsvRows(employees))
