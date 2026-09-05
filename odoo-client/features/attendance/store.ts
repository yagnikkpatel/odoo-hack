import { create } from '@/features/nexacrm/adapters/native-store'
import { ApiError } from '@/lib/api-client'
import { requireAttendanceId } from './attendance-mapper'
import * as service from './service'
import type {
  Attendance,
  AttendanceInput,
  AttendanceListQuery,
  AttendancePagination,
  AttendanceScope,
} from './types'

type AttendanceStore = {
  records: Attendance[]
  details: Record<string, Attendance>
  query: AttendanceListQuery
  pagination: AttendancePagination
  hasHydrated: boolean
  isLoading: boolean
  error: string | null
  today: Attendance | null
  todayLoading: boolean
  todayError: string | null
  loadRecords: (query?: AttendanceListQuery) => Promise<void>
  loadRecord: (id: string, scope?: AttendanceScope) => Promise<Attendance>
  loadToday: () => Promise<void>
  save: (input: AttendanceInput, id?: string) => Promise<string>
  remove: (id: string) => Promise<void>
  checkIn: () => Promise<Attendance>
  checkOut: () => Promise<Attendance>
}

function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Unable to load attendance. Please try again.'
}

function latest(record: Attendance, cached?: Attendance) {
  if (cached && Date.parse(cached.updatedAt) > Date.parse(record.updatedAt))
    return cached
  return record
}

let listVersion = 0
let todayVersion = 0
let listController: AbortController | undefined
const recordVersions = new Map<string, number>()
const detailRequests = new Map<string, Promise<Attendance>>()

export const useAttendanceStore = create<AttendanceStore>()((set, get) => {
  function remember(record: Attendance) {
    record = latest(record, get().details[record.id])
    set((state) => ({
      details: { ...state.details, [record.id]: record },
      records: state.records.map((item) =>
        item.id === record.id ? record : item,
      ),
      today: state.today?.id === record.id ? record : state.today,
    }))
  }

  function invalidateRecord(id: string) {
    recordVersions.set(id, (recordVersions.get(id) || 0) + 1)
    detailRequests.delete(`all:${id}`)
    detailRequests.delete(`own:${id}`)
  }

  async function refresh() {
    const requests: Promise<void>[] = [get().loadToday()]
    if (get().hasHydrated || get().isLoading) requests.push(get().loadRecords())
    // A successful write stays successful if a refresh fails.
    await Promise.allSettled(requests)
  }

  async function clock(action: () => Promise<Attendance>) {
    const record = await action()
    invalidateRecord(record.id)
    remember(record)
    await refresh()
    return record
  }

  return {
    records: [],
    details: {},
    query: { scope: 'own', limit: 15, offset: 0 },
    pagination: { total: 0, limit: 15, offset: 0, hasMore: false },
    hasHydrated: false,
    isLoading: false,
    error: null,
    today: null,
    todayLoading: false,
    todayError: null,

    async loadRecords(query = get().query) {
      const version = ++listVersion
      listController?.abort()
      listController = new AbortController()
      const { signal } = listController
      set({ query: { ...query }, isLoading: true, error: null, records: [] })
      try {
        const result = await service.listAttendances(query, signal)
        if (version !== listVersion) return
        const details = { ...get().details }
        const records = result.attendances.map((record) =>
          latest(record, details[record.id]),
        )
        for (const record of records) details[record.id] = record
        set({
          records,
          pagination: result.pagination,
          details,
          hasHydrated: true,
          isLoading: false,
        })
      } catch (error) {
        if (version !== listVersion || signal.aborted) return
        set({ error: message(error), hasHydrated: true, isLoading: false })
        throw error
      }
    },

    async loadRecord(id, scope = 'all') {
      requireAttendanceId(id)
      const key = `${scope}:${id}`
      const pending = detailRequests.get(key)
      if (pending) return pending
      const version = recordVersions.get(id) || 0
      async function fetchRecord() {
        if (scope === 'all') return service.getAttendance(id)
        // Employees can resolve details only through their own records.
        let offset = 0
        while (true) {
          const result = await service.listAttendances({
            scope: 'own',
            limit: 100,
            offset,
          })
          const record = result.attendances.find((item) => item.id === id)
          if (record) return record
          if (!result.pagination.hasMore || result.attendances.length === 0) {
            throw new ApiError('Attendance record not found.', 404)
          }
          offset += result.attendances.length
        }
      }
      const request = fetchRecord().then((record) => {
        if (version === (recordVersions.get(id) || 0)) remember(record)
        return record
      })
      detailRequests.set(key, request)
      try {
        return await request
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          version === (recordVersions.get(id) || 0)
        ) {
          set((state) => {
            const details = { ...state.details }
            delete details[id]
            return { details }
          })
        }
        throw error
      } finally {
        if (detailRequests.get(key) === request) detailRequests.delete(key)
      }
    },

    async loadToday() {
      const version = ++todayVersion
      set({ todayLoading: true, todayError: null })
      try {
        const result = await service.getMyTodayAttendance()
        if (version !== todayVersion) return
        const today = result ? latest(result, get().details[result.id]) : null
        set({ today, todayLoading: false })
        if (today) remember(today)
      } catch (error) {
        if (version !== todayVersion) return
        set({ todayError: message(error), todayLoading: false })
        throw error
      }
    },

    async save(input, id) {
      const saved = id
        ? await service.updateAttendance(id, {
            checkIn: input.checkIn || null,
            checkOut: input.checkOut || null,
            status: input.status,
            overtimeHours: input.overtimeHours,
            editReason: input.editReason,
          })
        : await service.createAttendance(input)
      invalidateRecord(saved.id)
      remember(saved)
      await refresh()
      return saved.id
    },

    async remove(id) {
      await service.deleteAttendance(id)
      invalidateRecord(id)
      set((state) => {
        const details = { ...state.details }
        delete details[id]
        return {
          details,
          records: state.records.filter((record) => record.id !== id),
          today: state.today?.id === id ? null : state.today,
        }
      })
      await refresh()
    },

    checkIn: () => clock(service.checkIn),
    checkOut: () => clock(service.checkOut),
  }
})
