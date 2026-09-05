import { create } from '@/features/nexacrm/adapters/native-store'
import { useEmployeesStore } from '@/features/employees/store'
import { DATA_API_CONNECTED, DATA_CONNECTION_MESSAGE } from '@/features/hr/data-availability'
import { validateSchedule } from './types'
import type { WorkingSchedule, ScheduleInput } from './types'
import type { SaveResult } from '@/features/attendance/types'

type SchedulesStore = {
  schedules: WorkingSchedule[]
  assignments: Record<string, string>
  hasHydrated: boolean
  initialize: (
    schedules: WorkingSchedule[],
    assignments: Record<string, string>,
  ) => void
  save: (input: ScheduleInput, id?: string) => SaveResult
  assign: (employeeId: string, scheduleId?: string) => SaveResult
  remove: (id: string) => SaveResult
}
export const useSchedulesStore = create<SchedulesStore>()((set, get) => ({
  schedules: [],
  assignments: {},
  hasHydrated: false,
  initialize: (schedules, assignments) => {
    if (!get().hasHydrated) set({ schedules, assignments, hasHydrated: true })
  },
  save: (raw, id) => {
    if (!DATA_API_CONNECTED) return { ok: false, error: DATA_CONNECTION_MESSAGE }
    if (id && !get().schedules.some((schedule) => schedule.id === id))
      return { ok: false, error: 'This schedule no longer exists.' }
    const input: ScheduleInput = {
      name: raw.name.trim(),
      type: raw.type,
      slots: raw.slots.map((slot) => ({
        day: slot.day,
        start: slot.start,
        end: slot.end,
        breakMinutes: slot.breakMinutes,
      })),
    }
    const error = validateSchedule(input)
    if (error) return { ok: false, error }
    const schedule: WorkingSchedule = {
      ...input,
      id: id || 'sch_' + crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
    }
    set((state) => ({
      schedules: id
        ? state.schedules.map((item) => (item.id === id ? schedule : item))
        : [schedule, ...state.schedules],
    }))
    return { ok: true, id: schedule.id }
  },
  assign: (employeeId, scheduleId) => {
    if (!DATA_API_CONNECTED) return { ok: false, error: DATA_CONNECTION_MESSAGE }
    if (
      !useEmployeesStore
        .getState()
        .employees.some((employee) => employee.id === employeeId)
    )
      return { ok: false, error: 'Choose an existing employee.' }
    if (
      scheduleId &&
      !get().schedules.some((schedule) => schedule.id === scheduleId)
    )
      return { ok: false, error: 'Choose an existing schedule.' }
    const assignments = { ...get().assignments }
    if (scheduleId) assignments[employeeId] = scheduleId
    else delete assignments[employeeId]
    set({ assignments })
    return { ok: true, id: employeeId }
  },
  remove: (id) => {
    if (!DATA_API_CONNECTED) return { ok: false, error: DATA_CONNECTION_MESSAGE }
    const employeeIds = new Set(
      useEmployeesStore.getState().employees.map((employee) => employee.id),
    )
    if (
      Object.entries(get().assignments).some(
        ([employeeId, scheduleId]) =>
          scheduleId === id && employeeIds.has(employeeId),
      )
    )
      return {
        ok: false,
        error:
          'Reassign or remove the employees from this schedule before deleting it.',
      }
    set((state) => ({
      schedules: state.schedules.filter((schedule) => schedule.id !== id),
      assignments: Object.fromEntries(
        Object.entries(state.assignments).filter(
          ([, scheduleId]) => scheduleId !== id,
        ),
      ),
    }))
    return { ok: true, id }
  },
}))
