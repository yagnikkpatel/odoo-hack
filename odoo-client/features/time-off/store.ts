import { create } from '@/features/nexacrm/adapters/native-store'
import { getCachedEmployeeIds } from '@/features/hr/employee-options'
import { useSchedulesStore } from '@/features/working-schedules/store'
import { calculateRequest, planConsumption } from './logic'
import * as service from './service'
import type {
  Allocation,
  AllocationInput,
  LeaveUnit,
  RequestInput,
  RequestPreview,
  Result,
  TimeOffData,
  TimeOffRequest,
  TimeOffType,
  TimeOffTypeInput
} from './model'

type TimeOffScope = 'own' | 'any'

type TimeOffStore = TimeOffData & {
  hasHydrated: boolean
  isLoading: boolean
  error: string | null
  load: (scope?: TimeOffScope) => Promise<void>
  saveType: (input: TimeOffTypeInput, id?: string) => Promise<Result>
  removeType: (id: string) => Promise<Result>
  saveAllocation: (input: AllocationInput, id?: string) => Promise<Result>
  approveAllocation: (id: string) => Promise<Result>
  refuseAllocation: (id: string, reason: string) => Promise<Result>
  removeAllocation: (id: string) => Promise<Result>
  saveRequest: (input: RequestInput, id?: string) => Promise<Result>
  approveRequest: (id: string) => Promise<Result>
  refuseRequest: (id: string, reason: string) => Promise<Result>
  cancelRequest: (id: string, reason: string) => Promise<Result>
  removeRequest: (id: string) => Promise<Result>
  previewRequest: (input: RequestInput) => RequestPreview
}

type Stored = { id: string; updatedAt: string }

const LOAD_ERROR = 'Unable to load time off. Please try again.'
const ACTION_ERROR = 'Something went wrong. Please try again.'

// The API supplies human-readable messages; the fallback only covers errors that carry none.
function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}

function latest<T extends Stored>(record: T, cached?: T): T {
  if (cached && Date.parse(cached.updatedAt) > Date.parse(record.updatedAt)) return cached
  return record
}

// A snapshot that started before a write must not roll that write back.
function reconcile<T extends Stored>(incoming: T[], current: T[]): T[] {
  const cached = new Map(current.map(item => [item.id, item]))
  return incoming.map(item => latest(item, cached.get(item.id)))
}

function merge<T extends Stored>(list: T[], record: T): T[] {
  return list.some(item => item.id === record.id)
    ? list.map(item => (item.id === record.id ? record : item))
    : [record, ...list]
}

const context = () => ({
  employeeIds: getCachedEmployeeIds(),
  schedules: useSchedulesStore.getState().schedules,
  assignments: useSchedulesStore.getState().assignments
})

// Wire format only: hourly fields are '' for day-unit types. The server validates the
// input and recomputes unit, duration, charges and consumptions authoritatively.
function requestPayload(input: RequestInput, unit?: LeaveUnit): RequestInput {
  return unit === 'days' ? { ...input, startTime: '', endTime: '' } : input
}

let loadVersion = 0
let loadController: AbortController | undefined
// Remembered so a post-mutation refresh() reuses the scope the page loaded with -
// an own-scope viewer must never be re-pointed at the any-scope snapshot.
let loadScope: TimeOffScope = 'any'

export const useTimeOffStore = create<TimeOffStore>()((set, get) => {
  // load() never rejects — it records the failure on `error` — so a refresh that fails
  // cannot undo a write that succeeded, and mount effects need no catch handler.
  async function refresh() {
    await Promise.allSettled([get().load(loadScope)])
  }

  async function mutate(action: () => Promise<string>, reload = false): Promise<Result> {
    try {
      const id = await action()
      // The returned record is merged by `action` first, so the refresh only adds to it.
      if (reload) await refresh()
      return { ok: true, id }
    } catch (error) {
      return { ok: false, error: message(error, ACTION_ERROR) }
    }
  }

  function rememberType(record: TimeOffType): string {
    set(state => ({ types: merge(state.types, latest(record, state.types.find(item => item.id === record.id))) }))
    return record.id
  }

  function rememberAllocation(record: Allocation): string {
    set(state => ({
      allocations: merge(state.allocations, latest(record, state.allocations.find(item => item.id === record.id)))
    }))
    return record.id
  }

  function rememberRequest(record: TimeOffRequest): string {
    set(state => ({
      requests: merge(state.requests, latest(record, state.requests.find(item => item.id === record.id)))
    }))
    return record.id
  }

  return {
    types: [],
    allocations: [],
    requests: [],
    hasHydrated: false,
    isLoading: false,
    error: null,

    async load(scope = loadScope) {
      loadScope = scope
      const version = ++loadVersion
      loadController?.abort()
      loadController = new AbortController()
      const { signal } = loadController
      set({ isLoading: true, error: null })
      try {
        const data = scope === 'own' ? await service.loadMyTimeOff(signal) : await service.loadTimeOff(signal)
        if (version !== loadVersion) return
        set({
          types: reconcile(data.types, get().types),
          allocations: reconcile(data.allocations, get().allocations),
          requests: reconcile(data.requests, get().requests),
          hasHydrated: true,
          isLoading: false,
          error: null
        })
      } catch (error) {
        if (version !== loadVersion || signal.aborted) return
        // Hydrated on failure too, so the table shows the error instead of an endless spinner.
        set({ error: message(error, LOAD_ERROR), hasHydrated: true, isLoading: false })
      }
    },

    saveType: (input, id) =>
      mutate(async () => rememberType(id ? await service.updateType(id, input) : await service.createType(input))),

    removeType: id =>
      mutate(async () => {
        await service.deleteType(id)
        set(state => ({ types: state.types.filter(item => item.id !== id) }))
        return id
      }, true),

    saveAllocation: (input, id) =>
      mutate(async () =>
        rememberAllocation(id ? await service.updateAllocation(id, input) : await service.createAllocation(input))
      ),

    approveAllocation: id => mutate(async () => rememberAllocation(await service.approveAllocation(id)), true),

    refuseAllocation: (id, reason) => mutate(async () => rememberAllocation(await service.refuseAllocation(id, reason))),

    removeAllocation: id =>
      mutate(async () => {
        await service.deleteAllocation(id)
        set(state => ({ allocations: state.allocations.filter(item => item.id !== id) }))
        return id
      }, true),

    saveRequest: (input, id) =>
      mutate(async () => {
        const payload = requestPayload(input, get().types.find(item => item.id === input.typeId)?.unit)
        return rememberRequest(id ? await service.updateRequest(id, payload) : await service.createRequest(payload))
      }, true),

    approveRequest: id => mutate(async () => rememberRequest(await service.approveRequest(id)), true),

    refuseRequest: (id, reason) => mutate(async () => rememberRequest(await service.refuseRequest(id, reason))),

    cancelRequest: (id, reason) => mutate(async () => rememberRequest(await service.cancelRequest(id, reason)), true),

    removeRequest: id =>
      mutate(async () => {
        await service.deleteRequest(id)
        set(state => ({ requests: state.requests.filter(item => item.id !== id) }))
        return id
      }, true),

    // Synchronous and local: this runs on every render of the request editor. The server
    // recomputes the same rules on submit and is the authority on the stored result.
    previewRequest: input => {
      const preview = calculateRequest(input, get(), context())
      if (!preview.ok) return preview
      const plan = planConsumption(get(), input.employeeId, input.typeId, preview.charges)
      return plan.ok ? preview : plan
    }
  }
})
