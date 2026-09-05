import { create } from '@/features/nexacrm/adapters/native-store'
import { getActorId } from '@/features/nexacrm/store/use-current-actor-store'
import { useEmployeesStore } from '@/features/employees/store'
import { validateContract } from './types'
import type { Contract, ContractInput } from './types'

type SaveResult = { ok: true; id: string } | { ok: false; error: string }
type ContractsStore = {
  contracts: Contract[]
  hasHydrated: boolean
  initialize: (contracts: Contract[]) => void
  save: (input: ContractInput, id?: string) => SaveResult
  remove: (id: string) => void
}
export const useContractsStore = create<ContractsStore>()((set, get) => ({
  contracts: [],
  hasHydrated: false,
  initialize: (contracts) => {
    if (!get().hasHydrated) set({ contracts, hasHydrated: true })
  },
  save: (raw, id) => {
    const input: ContractInput = {
      name: raw.name.trim(),
      employeeId: raw.employeeId,
      startDate: raw.startDate,
      department: raw.department.trim(),
      jobPosition: raw.jobPosition.trim(),
      wage: raw.wage,
      currency: raw.currency,
      wagePeriod: raw.wagePeriod,
      state: raw.state,
      salaryStructure: raw.salaryStructure.trim(),
      workingSchedule: raw.workingSchedule?.trim() || undefined,
      endDate: raw.endDate || undefined,
    }
    const before = id
      ? get().contracts.find((contract) => contract.id === id)
      : undefined
    if (id && !before)
      return {
        ok: false,
        error:
          'This contract no longer exists. Close the form and refresh the list.',
      }
    const error = validateContract(
      input,
      get().contracts,
      useEmployeesStore.getState().employees.map((employee) => employee.id),
      id,
    )
    if (error) return { ok: false, error }
    const now = new Date().toISOString()
    const actor = getActorId()
    const contract: Contract = {
      ...input,
      id: id || 'ctr_' + crypto.randomUUID(),
      createdAt: before?.createdAt || now,
      createdById: before ? before.createdById : actor,
      updatedAt: now,
      updatedById: actor,
    }
    set((state) => ({
      contracts: before
        ? state.contracts.map((item) => (item.id === id ? contract : item))
        : [contract, ...state.contracts],
    }))
    return { ok: true, id: contract.id }
  },
  // In-memory demo only. Backend payroll dependencies must be checked before enabling real deletion.
  remove: (id) =>
    set((state) => ({
      contracts: state.contracts.filter((contract) => contract.id !== id),
    })),
}))
export const useContract = (id?: string) =>
  useContractsStore((state) =>
    state.contracts.find((contract) => contract.id === id),
  )
