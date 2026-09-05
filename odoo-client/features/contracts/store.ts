import { create } from '@/features/nexacrm/adapters/native-store'
import { ApiError } from '@/lib/api-client'
import * as contractService from './service'
import { validateContract } from './types'
import type {
  Contract,
  ContractInput,
  ContractListQuery,
  ContractPagination,
} from './types'

type ContractsStore = {
  contracts: Contract[]
  details: Record<string, Contract>
  hasHydrated: boolean
  isLoading: boolean
  error: string | null
  query: ContractListQuery
  pagination: ContractPagination
  loadContracts: (query?: ContractListQuery) => Promise<void>
  loadContract: (id: string) => Promise<Contract>
  save: (input: ContractInput, id?: string) => Promise<string>
  remove: (id: string) => Promise<void>
  removeMany: (ids: string[]) => Promise<void>
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  return 'Unable to load contracts. Please try again.'
}

let listRequestNumber = 0
let listController: AbortController | undefined
const detailRequests = new Map<string, Promise<Contract>>()
const recordVersions = new Map<string, number>()

export const useContractsStore = create<ContractsStore>()((set, get) => {
  function remember(contract: Contract) {
    set((state) => ({
      details: { ...state.details, [contract.id]: contract },
      contracts: state.contracts.map((item) =>
        item.id === contract.id ? contract : item,
      ),
    }))
  }

  function rememberSaved(contract: Contract) {
    recordVersions.set(contract.id, (recordVersions.get(contract.id) || 0) + 1)
    detailRequests.delete(contract.id)
    remember(contract)
  }

  function forget(id: string) {
    recordVersions.set(id, (recordVersions.get(id) || 0) + 1)
    detailRequests.delete(id)
    set((state) => {
      const details = { ...state.details }
      delete details[id]
      return {
        details,
        contracts: state.contracts.filter((contract) => contract.id !== id),
      }
    })
  }

  async function refreshList() {
    if (!get().hasHydrated && !get().isLoading) return
    try {
      await get().loadContracts()
    } catch {
      // The write succeeded; the table keeps its retryable refresh error.
    }
  }

  return {
    contracts: [],
    details: {},
    hasHydrated: false,
    isLoading: false,
    error: null,
    query: { limit: 15, offset: 0 },
    pagination: { total: 0, limit: 15, offset: 0, hasMore: false },

    async loadContracts(query = get().query) {
      const requestNumber = ++listRequestNumber
      listController?.abort()
      listController = new AbortController()
      const signal = listController.signal
      set({ isLoading: true, error: null, query: { ...query } })
      try {
        const result = await contractService.listContracts(query, signal)
        if (requestNumber !== listRequestNumber) return
        const details = { ...get().details }
        for (const contract of result.contracts) {
          details[contract.id] = contract
        }
        set({
          ...result,
          details,
          hasHydrated: true,
          isLoading: false,
          error: null,
        })
      } catch (error) {
        if (requestNumber !== listRequestNumber || signal.aborted) return
        set({
          isLoading: false,
          hasHydrated: true,
          error: errorMessage(error),
        })
        throw error
      }
    },

    async loadContract(id) {
      const existing = get().details[id]
      if (existing) return existing
      const pending = detailRequests.get(id)
      if (pending) return pending
      const version = recordVersions.get(id) || 0
      const request = contractService.getContract(id).then((contract) => {
        if (version === (recordVersions.get(id) || 0)) remember(contract)
        return contract
      })
      detailRequests.set(id, request)
      try {
        return await request
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          version === (recordVersions.get(id) || 0)
        ) {
          forget(id)
        }
        throw error
      } finally {
        if (detailRequests.get(id) === request) detailRequests.delete(id)
      }
    },

    async save(input, id) {
      const validationError = validateContract(input)
      if (validationError) throw new Error(validationError)
      const saved = id
        ? await contractService.updateContract(id, {
            startDate: input.startDate,
            endDate: input.endDate,
            wage: input.wage,
            status: input.status,
          })
        : await contractService.createContract(input)
      rememberSaved(saved)
      await refreshList()
      return saved.id
    },

    async remove(id) {
      await contractService.deleteContract(id)
      forget(id)
      await refreshList()
    },

    async removeMany(ids) {
      let failure: unknown
      for (const id of new Set(ids)) {
        try {
          await contractService.deleteContract(id)
          forget(id)
        } catch (error) {
          failure = error
          break
        }
      }
      await refreshList()
      if (failure) throw failure
    },
  }
})

export function useContract(id?: string) {
  return useContractsStore((state) => (id ? state.details[id] : undefined))
}
