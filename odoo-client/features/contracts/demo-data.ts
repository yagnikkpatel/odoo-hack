import type { Employee } from '@/features/employees/types'
import type { Contract } from './types'

/** Illustrative terms, not inferred employee salaries. Kept separate from CRM and employee master data. */
export function demoContracts(
  employees: Employee[],
  year = new Date().getFullYear(),
): Contract[] {
  const specifications = [
    {
      employee: 0,
      label: 'Employment agreement',
      start: `${year}-01-01`,
      wage: 85000,
      department: 'Engineering',
      state: 'active',
    },
    {
      employee: 1,
      label: 'Employment agreement',
      start: `${year}-02-01`,
      wage: 72000,
      department: 'Sales',
      state: 'active',
    },
    {
      employee: 2,
      label: 'Renewal draft',
      start: `${year + 1}-01-01`,
      wage: 64000,
      department: 'Sales',
      state: 'draft',
    },
    {
      employee: 3,
      label: 'Fixed-term agreement',
      start: `${year - 1}-01-01`,
      end: `${year - 1}-12-31`,
      wage: 78000,
      department: 'Product',
      state: 'active',
    },
    {
      employee: 4,
      label: 'Employment agreement',
      start: `${year}-01-01`,
      wage: 68000,
      department: 'Marketing',
      state: 'active',
    },
    {
      employee: 5,
      label: 'Upcoming agreement',
      start: `${year + 1}-01-01`,
      wage: 95000,
      department: 'Engineering',
      state: 'active',
    },
    {
      employee: 0,
      label: 'Previous agreement',
      start: `${year - 1}-01-01`,
      end: `${year - 1}-12-31`,
      wage: 75000,
      department: 'Engineering',
      state: 'active',
    },
  ] as const
  return specifications.flatMap((spec, index) => {
    const employee = employees[spec.employee]
    if (!employee) return []
    const createdDate =
      spec.start < `${year}-01-01` ? spec.start : `${year}-01-01`
    const timestamp = createdDate + 'T09:00:00.000Z'
    return [
      {
        id: 'ctr_demo_' + (index + 1),
        name: spec.label,
        employeeId: employee.id,
        startDate: spec.start,
        endDate: 'end' in spec ? spec.end : undefined,
        department: spec.department,
        jobPosition: employee.jobTitle || 'Team member',
        wage: spec.wage,
        currency: 'INR',
        wagePeriod: 'month',
        salaryStructure: 'Regular salary',
        workingSchedule: 'Standard 40-hour week',
        state: spec.state,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]
  })
}
