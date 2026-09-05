import { create } from '@/features/nexacrm/adapters/native-store'
import { getActorId } from '@/features/nexacrm/store/use-current-actor-store'
import { requireDataConnection } from '@/features/hr/data-availability'
import {
  EMPLOYEE_FIELD_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  STATUS_LABELS,
  employeeName,
} from './types'
import type {
  Employee,
  EmployeeInput,
  EmployeeActivity,
  EmployeeChange,
} from './types'

type EmployeeStore = {
  employees: Employee[]
  activities: EmployeeActivity[]
  hasHydrated: boolean
  initialize: (employees: Employee[]) => void
  addEmployee: (input: EmployeeInput) => string
  addEmployees: (inputs: EmployeeInput[]) => void
  updateEmployee: (id: string, input: Partial<EmployeeInput>) => void
  deleteEmployees: (ids: string[]) => void
}

const buildEmployee = (input: EmployeeInput): Employee => {
  const now = new Date().toISOString()
  const actor = getActorId()
  return {
    ...input,
    id: 'emp_' + crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    createdById: actor,
    updatedById: actor,
  }
}

// Employee identity remains independent of the CRM entities.
export const useEmployeesStore = create<EmployeeStore>()((set, get) => ({
  employees: [],
  activities: [],
  hasHydrated: false,
  initialize: (employees) => {
    if (!get().hasHydrated) set({ employees, hasHydrated: true })
  },
  addEmployee: (input) => {
    requireDataConnection()
    const employee = buildEmployee(input)
    set((state) => ({
      employees: [employee, ...state.employees],
      activities: [
        {
          id: crypto.randomUUID(),
          employeeId: employee.id,
          at: employee.createdAt,
          actorId: employee.createdById,
          verb: 'created',
          subject: employeeName(employee),
        },
        ...state.activities,
      ],
    }))
    return employee.id
  },
  addEmployees: (inputs) => {
    requireDataConnection()
    inputs.forEach((input) => get().addEmployee(input))
  },
  updateEmployee: (id, input) => {
    requireDataConnection()
    const before = get().employees.find((employee) => employee.id === id)
    if (!before) return
    if (input.managerId === id)
      throw new Error('An employee cannot be their own manager.')
    if (
      input.managerId &&
      !get().employees.some((employee) => employee.id === input.managerId)
    ) {
      throw new Error('Choose an existing employee as manager.')
    }
    const changes: EmployeeChange[] = []
    for (const key of Object.keys(input) as (keyof EmployeeInput)[]) {
      if (before[key] === input[key]) continue
      const raw = input[key]
      const value =
        key === 'managerId'
          ? get().employees.find((employee) => employee.id === raw)
          : key === 'status'
            ? STATUS_LABELS[raw as keyof typeof STATUS_LABELS]
            : key === 'employmentType'
              ? EMPLOYMENT_TYPE_LABELS[
                  raw as keyof typeof EMPLOYMENT_TYPE_LABELS
                ]
              : raw
      changes.push({
        label: EMPLOYEE_FIELD_LABELS[key],
        value:
          typeof value === 'object' && value
            ? employeeName(value)
            : value || undefined,
      })
    }
    if (!changes.length) return
    const now = new Date().toISOString()
    const next = {
      ...before,
      ...input,
      updatedAt: now,
      updatedById: getActorId(),
    }
    set((state) => ({
      employees: state.employees.map((employee) =>
        employee.id === id ? next : employee,
      ),
      activities: [
        {
          id: crypto.randomUUID(),
          employeeId: id,
          at: now,
          actorId: next.updatedById,
          verb: 'updated',
          subject: employeeName(next),
          changes,
        },
        ...state.activities,
      ],
    }))
  },
  deleteEmployees: (ids) => {
    requireDataConnection()
    const removed = new Set(ids)
    // Real contract/payroll dependency checks belong at the backend boundary.
    // Clear manager references before removing records.
    for (const employee of get().employees) {
      if (
        !removed.has(employee.id) &&
        employee.managerId &&
        removed.has(employee.managerId)
      ) {
        get().updateEmployee(employee.id, { managerId: undefined })
      }
    }
    set((state) => ({
      employees: state.employees.filter(
        (employee) => !removed.has(employee.id),
      ),
      activities: state.activities.filter(
        (activity) => !removed.has(activity.employeeId),
      ),
    }))
  },
}))
export const useEmployee = (id?: string) =>
  useEmployeesStore((state) =>
    state.employees.find((employee) => employee.id === id),
  )
