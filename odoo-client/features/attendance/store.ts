import { create } from '@/features/nexacrm/adapters/native-store'
import { getActorId } from '@/features/nexacrm/store/use-current-actor-store'
import { useEmployeesStore } from '@/features/employees/store'
import { DATA_API_CONNECTED, DATA_CONNECTION_MESSAGE, requireDataConnection } from '@/features/hr/data-availability'
import { localDateTime, validateAttendance } from './types'
import type { Attendance, AttendanceInput, SaveResult } from './types'

const fields = (raw: AttendanceInput): AttendanceInput => ({
  employeeId: raw.employeeId,
  checkIn: raw.checkIn,
  checkOut: raw.checkOut || undefined,
  breakMinutes: raw.breakMinutes,
  note: raw.note.trim(),
})
type AttendanceStore = {
  records: Attendance[]
  hasHydrated: boolean
  initialize: (records: Attendance[]) => void
  save: (input: AttendanceInput, id?: string, reason?: string) => SaveResult
  checkOut: (id: string) => SaveResult
  remove: (id: string) => void
}
export const useAttendanceStore = create<AttendanceStore>()((set, get) => ({
  records: [],
  hasHydrated: false,
  initialize: (records) => {
    if (!get().hasHydrated) set({ records, hasHydrated: true })
  },
  save: (raw, id, reason) => {
    if (!DATA_API_CONNECTED) return { ok: false, error: DATA_CONNECTION_MESSAGE }
    const before = get().records.find((record) => record.id === id)
    if (id && !before)
      return { ok: false, error: 'This attendance record no longer exists.' }
    if (before && !reason?.trim())
      return { ok: false, error: 'Add a reason for this correction.' }
    const input = fields(raw)
    const error = validateAttendance(
      input,
      get().records,
      useEmployeesStore.getState().employees.map((employee) => employee.id),
      id,
    )
    if (error) return { ok: false, error }
    if (before && JSON.stringify(fields(before)) === JSON.stringify(input))
      return { ok: false, error: 'Change an attendance value before saving a correction.' }
    const at = new Date().toISOString()
    const actorId = getActorId()
    const record: Attendance = {
      ...input,
      id: id || 'att_' + crypto.randomUUID(),
      createdAt: before?.createdAt || at,
      createdById: before ? before.createdById : actorId,
      corrections: before
        ? [
            ...before.corrections,
            {
              at,
              actorId,
              reason: reason!.trim(),
              before: fields(before),
              after: input,
            },
          ]
        : [],
    }
    set((state) => ({
      records: before
        ? state.records.map((item) => (item.id === id ? record : item))
        : [record, ...state.records],
    }))
    return { ok: true, id: record.id }
  },
  checkOut: (id) => {
    if (!DATA_API_CONNECTED) return { ok: false, error: DATA_CONNECTION_MESSAGE }
    const before = get().records.find((record) => record.id === id)
    if (!before || before.checkOut)
      return { ok: false, error: 'This record is no longer checked in.' }
    if (before.checkIn.slice(0, 10) !== localDateTime().slice(0, 10))
      return {
        ok: false,
        error:
          'Use Correct attendance to resolve a missing check-out from an earlier day.',
      }
    const input = { ...fields(before), checkOut: localDateTime() }
    const error = validateAttendance(
      input,
      get().records,
      useEmployeesStore.getState().employees.map((employee) => employee.id),
      id,
    )
    if (error) return { ok: false, error }
    set((state) => ({
      records: state.records.map((item) =>
        item.id === id ? { ...item, ...input } : item,
      ),
    }))
    return { ok: true, id }
  },
  remove: (id) => {
    requireDataConnection()
    set((state) => ({
      records: state.records.filter((record) => record.id !== id),
    }))
  },
}))
