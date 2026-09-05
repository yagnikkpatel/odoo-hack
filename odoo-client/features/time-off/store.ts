import { create } from '@/features/nexacrm/adapters/native-store'
import { getActorId } from '@/features/nexacrm/store/use-current-actor-store'
import { useEmployeesStore } from '@/features/employees/store'
import { useSchedulesStore } from '@/features/working-schedules/store'
import { DATA_API_CONNECTED, DATA_CONNECTION_MESSAGE } from '@/features/hr/data-availability'
import {
  calculateRequest,
  hourlyCapacityError,
  planConsumption,
  requestsOverlap,
  validateAllocation,
  validateType
} from './logic'
import type {
  Allocation,
  AllocationInput,
  Decision,
  RequestInput,
  RequestPreview,
  Result,
  TimeOffData,
  TimeOffRequest,
  TimeOffType,
  TimeOffTypeInput
} from './model'

type TimeOffStore = TimeOffData & {
  hasHydrated: boolean
  initialize: (data: TimeOffData) => void
  saveType: (input: TimeOffTypeInput, id?: string) => Result
  removeType: (id: string) => Result
  saveAllocation: (input: AllocationInput, id?: string) => Result
  approveAllocation: (id: string) => Result
  refuseAllocation: (id: string, reason: string) => Result
  removeAllocation: (id: string) => Result
  saveRequest: (input: RequestInput, id?: string) => Result
  approveRequest: (id: string) => Result
  refuseRequest: (id: string, reason: string) => Result
  cancelRequest: (id: string, reason: string) => Result
  removeRequest: (id: string) => Result
  previewRequest: (input: RequestInput) => RequestPreview
}
const failure = (error: string): Result => ({ ok: false, error })
const now = () => new Date().toISOString()
const decision = (action: string, at: string, reason?: string): Decision => ({
  at,
  actorId: getActorId(),
  action,
  ...(reason ? { reason } : {})
})
const context = () => ({
  employeeIds: useEmployeesStore.getState().employees.map(employee => employee.id),
  schedules: useSchedulesStore.getState().schedules,
  assignments: useSchedulesStore.getState().assignments
})
const typeFields = (raw: TimeOffTypeInput): TimeOffTypeInput => ({
  name: raw.name.trim(),
  code: raw.code.trim().toUpperCase(),
  unit: raw.unit,
  requiresAllocation: raw.requiresAllocation,
  approval: raw.approval,
  payroll: raw.payroll,
  active: raw.active,
  description: raw.description.trim()
})
const allocationFields = (raw: AllocationInput): AllocationInput => ({
  employeeId: raw.employeeId,
  typeId: raw.typeId,
  amount: raw.amount,
  validFrom: raw.validFrom,
  validTo: raw.validTo,
  note: raw.note.trim()
})
const requestFields = (raw: RequestInput, unit?: string): RequestInput => ({
  employeeId: raw.employeeId,
  typeId: raw.typeId,
  startDate: raw.startDate,
  endDate: raw.endDate,
  startTime: unit === 'days' ? '' : raw.startTime,
  endTime: unit === 'days' ? '' : raw.endTime,
  reason: raw.reason.trim()
})

export const useTimeOffStore = create<TimeOffStore>()((set, get) => ({
  types: [],
  allocations: [],
  requests: [],
  hasHydrated: false,
  initialize: data => {
    if (!get().hasHydrated) set({ ...structuredClone(data), hasHydrated: true })
  },
  saveType: (raw, id) => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    const before = get().types.find(item => item.id === id)
    if (id && !before) return failure('This time off type no longer exists.')
    const input = typeFields(raw)
    const error = validateType(input, get(), id)
    if (error) return failure(error)
    const at = now()
    const type: TimeOffType = {
      ...input,
      id: id || 'leave_type_' + crypto.randomUUID(),
      createdAt: before?.createdAt || at,
      updatedAt: at
    }
    set(state => ({ types: before ? state.types.map(item => (item.id === id ? type : item)) : [type, ...state.types] }))
    return { ok: true, id: type.id }
  },
  removeType: id => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    if (!get().types.some(item => item.id === id)) return failure('This time off type no longer exists.')
    if (get().allocations.some(item => item.typeId === id) || get().requests.some(item => item.typeId === id))
      return failure('This type is referenced by allocations or requests. Archive it instead.')
    set(state => ({ types: state.types.filter(item => item.id !== id) }))
    return { ok: true, id }
  },
  saveAllocation: (raw, id) => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    const before = get().allocations.find(item => item.id === id)
    if (id && !before) return failure('This allocation no longer exists.')
    if (before?.status === 'approved')
      return failure('Approved allocations cannot be edited. Create a separate allocation instead.')
    const input = allocationFields(raw)
    const error = validateAllocation(input, get(), context().employeeIds)
    if (error) return failure(error)
    const at = now()
    const allocation: Allocation = {
      ...input,
      id: id || 'leave_allocation_' + crypto.randomUUID(),
      status: 'pending',
      createdAt: before?.createdAt || at,
      updatedAt: at,
      history: [...(before?.history || []), decision(before ? 'Resubmitted' : 'Submitted', at)]
    }
    set(state => ({
      allocations: before
        ? state.allocations.map(item => (item.id === id ? allocation : item))
        : [allocation, ...state.allocations]
    }))
    return { ok: true, id: allocation.id }
  },
  approveAllocation: id => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    const before = get().allocations.find(item => item.id === id)
    if (!before || before.status !== 'pending') return failure('Only pending allocations can be approved.')
    const error = validateAllocation(before, get(), context().employeeIds)
    if (error) return failure(error)
    const at = now()
    set(state => ({
      allocations: state.allocations.map(item =>
        item.id === id
          ? { ...item, status: 'approved', updatedAt: at, history: [...item.history, decision('Approved', at)] }
          : item
      )
    }))
    return { ok: true, id }
  },
  refuseAllocation: (id, rawReason) => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    const before = get().allocations.find(item => item.id === id)
    if (!before || before.status !== 'pending') return failure('Only pending allocations can be refused.')
    const reason = rawReason.trim()
    if (!reason) return failure('Add a reason for refusing the allocation.')
    const at = now()
    set(state => ({
      allocations: state.allocations.map(item =>
        item.id === id
          ? { ...item, status: 'refused', updatedAt: at, history: [...item.history, decision('Refused', at, reason)] }
          : item
      )
    }))
    return { ok: true, id }
  },
  removeAllocation: id => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    const before = get().allocations.find(item => item.id === id)
    if (!before) return failure('This allocation no longer exists.')
    if (get().requests.some(item => item.consumptions.some(charge => charge.allocationId === id)))
      return failure('This allocation is linked to approved leave history and cannot be deleted.')
    if (before.status === 'approved')
      return failure('Approved allocations are historical records and cannot be deleted.')
    set(state => ({ allocations: state.allocations.filter(item => item.id !== id) }))
    return { ok: true, id }
  },
  previewRequest: input => {
    const preview = calculateRequest(input, get(), context())
    if (!preview.ok) return preview
    const plan = planConsumption(get(), input.employeeId, input.typeId, preview.charges)
    return plan.ok ? preview : plan
  },
  saveRequest: (raw, id) => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    const before = get().requests.find(item => item.id === id)
    if (id && !before) return failure('This request no longer exists.')
    if (before && !['pending', 'refused'].includes(before.status))
      return failure(
        'Only pending or refused requests can be edited. Cancel approved leave before submitting a replacement.'
      )
    const type = get().types.find(item => item.id === raw.typeId)
    const input = requestFields(raw, type?.unit)
    if (!input.reason) return failure('Add a reason for the time off request.')
    const preview = calculateRequest(input, get(), context())
    if (!preview.ok) return preview
    const candidate = { ...input, ...preview }
    if (get().requests.some(item => item.id !== id && requestsOverlap(candidate, item)))
      return failure('This employee already has pending or approved time off during this period.')
    const capacityError = hourlyCapacityError(candidate, get(), context(), id)
    if (capacityError) return failure(capacityError)
    const plan = planConsumption(get(), input.employeeId, input.typeId, preview.charges)
    if (!plan.ok) return plan
    const at = now()
    const automatic = type?.approval === 'none'
    const request: TimeOffRequest = {
      ...input,
      id: id || 'leave_request_' + crypto.randomUUID(),
      unit: preview.unit,
      duration: preview.duration,
      charges: preview.charges,
      consumptions: automatic ? plan.consumptions : [],
      status: automatic ? 'approved' : 'pending',
      createdAt: before?.createdAt || at,
      updatedAt: at,
      history: [
        ...(before?.history || []),
        decision(before ? 'Resubmitted' : 'Submitted', at),
        ...(automatic ? [decision('Automatically approved', at)] : [])
      ]
    }
    set(state => ({
      requests: before ? state.requests.map(item => (item.id === id ? request : item)) : [request, ...state.requests]
    }))
    return { ok: true, id: request.id }
  },
  approveRequest: id => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    const before = get().requests.find(item => item.id === id)
    if (!before || before.status !== 'pending') return failure('Only pending requests can be approved.')
    const preview = calculateRequest(before, get(), context())
    if (!preview.ok) return preview
    if (
      preview.unit !== before.unit ||
      preview.duration !== before.duration ||
      JSON.stringify(preview.charges) !== JSON.stringify(before.charges)
    )
      return failure('The working schedule changed. Edit and resubmit this request to review its updated duration.')
    if (get().requests.some(item => item.id !== id && requestsOverlap(before, item)))
      return failure('This employee has another pending or approved request during this period.')
    const capacityError = hourlyCapacityError(before, get(), context(), id)
    if (capacityError) return failure(capacityError)
    const plan = planConsumption(get(), before.employeeId, before.typeId, before.charges)
    if (!plan.ok) return plan
    const at = now()
    set(state => ({
      requests: state.requests.map(item =>
        item.id === id
          ? {
              ...item,
              consumptions: plan.consumptions,
              status: 'approved',
              updatedAt: at,
              history: [...item.history, decision('Approved', at)]
            }
          : item
      )
    }))
    return { ok: true, id }
  },
  refuseRequest: (id, rawReason) => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    const before = get().requests.find(item => item.id === id)
    if (!before || before.status !== 'pending') return failure('Only pending requests can be refused.')
    const reason = rawReason.trim()
    if (!reason) return failure('Add a reason for refusing the request.')
    const at = now()
    set(state => ({
      requests: state.requests.map(item =>
        item.id === id
          ? { ...item, status: 'refused', updatedAt: at, history: [...item.history, decision('Refused', at, reason)] }
          : item
      )
    }))
    return { ok: true, id }
  },
  cancelRequest: (id, rawReason) => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    const before = get().requests.find(item => item.id === id)
    if (!before || !['pending', 'approved'].includes(before.status))
      return failure('Only pending or approved requests can be cancelled.')
    const reason = rawReason.trim()
    if (!reason) return failure('Add a reason for cancelling the request.')
    const at = now()
    // Retain consumption references for audit; only approved requests count in balances.
    set(state => ({
      requests: state.requests.map(item =>
        item.id === id
          ? {
              ...item,
              status: 'cancelled',
              updatedAt: at,
              history: [...item.history, decision('Cancelled', at, reason)]
            }
          : item
      )
    }))
    return { ok: true, id }
  },
  removeRequest: id => {
    if (!DATA_API_CONNECTED) return failure(DATA_CONNECTION_MESSAGE)
    const before = get().requests.find(item => item.id === id)
    if (!before) return failure('This request no longer exists.')
    if (before.status === 'approved')
      return failure('Cancel approved leave before deleting it, so its balance is restored.')
    set(state => ({ requests: state.requests.filter(item => item.id !== id) }))
    return { ok: true, id }
  }
}))
