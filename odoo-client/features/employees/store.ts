import { create } from '@/features/nexacrm/adapters/native-store'
import { ApiError } from '@/lib/api-client'
import * as employeeService from './service'
import { emptyEmployeeSummary } from './types'
import type {
  Employee,
  EmployeeAccount,
  EmployeeCreateInput,
  EmployeeImageType,
  EmployeeListQuery,
  EmployeeManager,
  EmployeePagination,
  EmployeeSummary,
  EmployeeUpdateInput
} from './types'

type EmployeeStore = {
  employees: Employee[]
  details: Record<string, Employee>
  hasHydrated: boolean
  isLoading: boolean
  error: string | null
  query: EmployeeListQuery
  pagination: EmployeePagination
  summary: EmployeeSummary
  managers: EmployeeManager[]
  accounts: EmployeeAccount[]
  optionsLoading: boolean
  optionsError: string | null
  initialize: (employees: Employee[]) => void
  loadEmployees: (query?: EmployeeListQuery) => Promise<void>
  loadEmployee: (id: string) => Promise<Employee>
  loadOptions: () => Promise<void>
  addEmployee: (input: EmployeeCreateInput) => Promise<string>
  updateEmployee: (id: string, input: EmployeeUpdateInput) => Promise<void>
  deleteEmployees: (ids: string[]) => Promise<void>
  uploadImages: (id: string, images: FormData) => Promise<void>
  deleteImage: (id: string, imageType: EmployeeImageType) => Promise<void>
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  return 'Unable to load employees. Please try again.'
}

let listRequestNumber = 0
let listController: AbortController | undefined
let optionsRequest: Promise<void> | undefined
const detailRequests = new Map<string, Promise<Employee>>()
const recordVersions = new Map<string, number>()

export const useEmployeesStore = create<EmployeeStore>()((set, get) => {
  function rememberEmployee(employee: Employee) {
    set(state => ({
      details: { ...state.details, [employee.id]: employee },
      employees: state.employees.map(record => {
        if (record.id === employee.id) {
          return employee
        }
        return record
      })
    }))
  }

  function forgetEmployee(id: string) {
    recordVersions.set(id, (recordVersions.get(id) || 0) + 1)
    detailRequests.delete(id)
    set(state => {
      const details = { ...state.details }
      delete details[id]
      return { details, employees: state.employees.filter(employee => employee.id !== id) }
    })
  }

  async function refreshDirectory() {
    if (!get().hasHydrated && !get().isLoading) {
      return
    }
    try {
      await get().loadEmployees()
    } catch {
      // The write succeeded. Keep that result and show the list's retry error,
      // rather than inviting a duplicate create by reporting the save as failed.
    }
  }

  function rememberSavedEmployee(employee: Employee) {
    recordVersions.set(employee.id, (recordVersions.get(employee.id) || 0) + 1)
    detailRequests.delete(employee.id)
    rememberEmployee(employee)
  }

  return {
    employees: [],
    details: {},
    hasHydrated: false,
    isLoading: false,
    error: null,
    query: { limit: 15, offset: 0 },
    pagination: { total: 0, limit: 15, offset: 0, hasMore: false },
    summary: emptyEmployeeSummary(),
    managers: [],
    accounts: [],
    optionsLoading: false,
    optionsError: null,

    // Supports server-supplied snapshots and pure domain tests; never creates records.
    initialize(employees) {
      if (get().hasHydrated) {
        return
      }
      const details = Object.fromEntries(employees.map(employee => [employee.id, employee]))
      set({ employees, details, hasHydrated: true })
    },

    async loadEmployees(query = get().query) {
      const requestNumber = ++listRequestNumber
      listController?.abort()
      listController = new AbortController()
      const signal = listController.signal
      set({ isLoading: true, error: null, query: { ...query } })
      try {
        const result = await employeeService.listEmployees(query, signal)
        if (requestNumber !== listRequestNumber) {
          return
        }
        const details = { ...get().details }
        for (const employee of result.employees) {
          details[employee.id] = employee
        }
        set({ ...result, details, hasHydrated: true, isLoading: false, error: null })
      } catch (error) {
        if (requestNumber !== listRequestNumber || signal.aborted) {
          return
        }
        set({ isLoading: false, hasHydrated: true, error: errorMessage(error) })
        throw error
      }
    },

    async loadEmployee(id) {
      const pending = detailRequests.get(id)
      if (pending) {
        return pending
      }
      const version = recordVersions.get(id) || 0
      const request = employeeService.getEmployee(id).then(employee => {
        if (version === (recordVersions.get(id) || 0)) {
          rememberEmployee(employee)
        }
        return employee
      })
      detailRequests.set(id, request)
      try {
        return await request
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          if (version === (recordVersions.get(id) || 0)) {
            forgetEmployee(id)
          }
        }
        throw error
      } finally {
        if (detailRequests.get(id) === request) {
          detailRequests.delete(id)
        }
      }
    },

    async loadOptions() {
      if (optionsRequest) {
        return optionsRequest
      }
      set({ optionsLoading: true, optionsError: null })
      optionsRequest = Promise.all([
        employeeService.listEmployeeOptions('managers'),
        employeeService.listEmployeeOptions('accounts')
      ]).then(([managers, accounts]) => {
        set({ managers, accounts, optionsLoading: false })
      }).catch(error => {
        set({ optionsLoading: false, optionsError: errorMessage(error) })
        throw error
      })
      try {
        await optionsRequest
      } finally {
        optionsRequest = undefined
      }
    },

    async addEmployee(input) {
      const employee = await employeeService.createEmployee(input)
      rememberSavedEmployee(employee)
      set(state => ({ accounts: state.accounts.filter(account => account.id !== employee.id) }))
      await refreshDirectory()
      return employee.id
    },

    async updateEmployee(id, input) {
      const employee = await employeeService.updateEmployee(id, input)
      rememberSavedEmployee(employee)
      await refreshDirectory()
    },

    async deleteEmployees(ids) {
      let failure: unknown
      for (const id of new Set(ids)) {
        try {
          await employeeService.deleteEmployee(id)
          forgetEmployee(id)
        } catch (error) {
          failure = error
          break
        }
      }
      await refreshDirectory()
      if (failure) {
        throw failure
      }
    },

    async uploadImages(id, images) {
      const savedImages = await employeeService.uploadEmployeeImages(id, images)
      const employee = get().details[id]
      if (employee) {
        rememberSavedEmployee({ ...employee, ...savedImages })
      }
      await refreshDirectory()
    },

    async deleteImage(id, imageType) {
      const savedImages = await employeeService.deleteEmployeeImage(id, imageType)
      const employee = get().details[id]
      if (employee) {
        rememberSavedEmployee({ ...employee, ...savedImages })
      }
      await refreshDirectory()
    }
  }
})

export function useEmployee(id?: string) {
  return useEmployeesStore(state => {
    if (!id) {
      return undefined
    }
    return state.details[id]
  })
}
