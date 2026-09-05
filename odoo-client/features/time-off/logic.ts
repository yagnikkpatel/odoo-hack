import { slotMinutes, timeMinutes } from '@/features/working-schedules/types'
import type { WorkingSchedule } from '@/features/working-schedules/types'
import type {
  AllocationInput,
  Balance,
  Consumption,
  DayCharge,
  LeaveUnit,
  RequestInput,
  RequestPreview,
  TimeOffData,
  TimeOffRequest,
  TimeOffTypeInput
} from './model'

export type ScheduleContext = {
  employeeIds: string[]
  schedules: WorkingSchedule[]
  assignments: Record<string, string>
}
const EPSILON = 1e-8
// Keep minute-sized hour fractions precise enough that repeated approvals do not
// manufacture a shortfall; presentation alone rounds to two decimal places.
export const rounded = (amount: number) => Math.round(amount * 1e12) / 1e12
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T12:00:00Z')
  return (
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    value >= '1900-01-01' &&
    value <= '2100-12-31'
  )
}
export function dateRange(start: string, end: string): string[] {
  if (!validDate(start) || !validDate(end) || start > end) return []
  const days = Math.round((Date.parse(end + 'T12:00:00Z') - Date.parse(start + 'T12:00:00Z')) / 86400000) + 1
  if (days > 366) return []
  return Array.from({ length: days }, (_, index) =>
    new Date(Date.parse(start + 'T12:00:00Z') + index * 86400000).toISOString().slice(0, 10)
  )
}
export function validateType(input: TimeOffTypeInput, data: TimeOffData, id?: string): string | null {
  if (!input.name.trim() || input.name.trim().length > 100) return 'Enter a name between 1 and 100 characters.'
  if (!/^[A-Z0-9_-]{1,16}$/.test(input.code)) return 'Use a code of 1–16 letters, numbers, hyphens or underscores.'
  if (!['days', 'hours'].includes(input.unit)) return 'Choose days or hours.'
  if (!['manager', 'none'].includes(input.approval)) return 'Choose a valid approval policy.'
  if (!['paid', 'unpaid'].includes(input.payroll)) return 'Choose a valid payroll treatment.'
  if (typeof input.requiresAllocation !== 'boolean' || typeof input.active !== 'boolean')
    return 'Choose valid leave policy settings.'
  if (
    data.types.some(
      type =>
        type.id !== id &&
        (type.code.toLowerCase() === input.code.toLowerCase() || type.name.toLowerCase() === input.name.toLowerCase())
    )
  )
    return 'A time off type already uses this name or code.'
  const before = data.types.find(type => type.id === id)
  const referenced = data.allocations.some(item => item.typeId === id) || data.requests.some(item => item.typeId === id)
  if (
    before &&
    referenced &&
    ['unit', 'requiresAllocation', 'approval', 'payroll'].some(
      key => before[key as keyof TimeOffTypeInput] !== input[key as keyof TimeOffTypeInput]
    )
  )
    return 'This type is already used. Create a new type to change its unit, allocation, approval or payroll policy.'
  return null
}
export function validateAllocation(input: AllocationInput, data: TimeOffData, employeeIds: string[]): string | null {
  if (!employeeIds.includes(input.employeeId)) return 'Choose an existing employee.'
  const type = data.types.find(item => item.id === input.typeId)
  if (!type?.active) return 'Choose an active time off type.'
  if (!type.requiresAllocation) return 'This time off type does not require allocations.'
  if (!Number.isFinite(input.amount) || input.amount <= 0 || input.amount > 100000)
    return 'Enter a positive allocation of no more than 100,000 units.'
  if (!validDate(input.validFrom) || (input.validTo !== '' && !validDate(input.validTo)))
    return 'Enter valid allocation dates between 1900 and 2100.'
  if (input.validTo && input.validFrom > input.validTo) return 'Allocation expiry cannot be before its start date.'
  return null
}

function periodsForDate(employeeId: string, date: string, context: ScheduleContext) {
  const day = (new Date(date + 'T12:00:00Z').getUTCDay() + 6) % 7
  const scheduleId = context.assignments[employeeId]
  const schedule = context.schedules.find(item => item.id === scheduleId)
  // Only unassigned employees use the explicitly documented weekday fallback.
  if (scheduleId && !schedule) return null
  return schedule
    ? schedule.slots.filter(slot => slot.day === day)
    : day < 5
      ? [{ day, start: '09:00', end: '18:00', breakMinutes: 60 }]
      : []
}
export function calculateRequest(input: RequestInput, data: TimeOffData, context: ScheduleContext): RequestPreview {
  if (!context.employeeIds.includes(input.employeeId)) return { ok: false, error: 'Choose an existing employee.' }
  const type = data.types.find(item => item.id === input.typeId)
  if (!type?.active) return { ok: false, error: 'Choose an active time off type.' }
  if (!validDate(input.startDate) || !validDate(input.endDate))
    return { ok: false, error: 'Enter valid request dates between 1900 and 2100.' }
  if (input.startDate > input.endDate) return { ok: false, error: 'End date cannot be before start date.' }
  const dates = dateRange(input.startDate, input.endDate)
  if (!dates.length) return { ok: false, error: 'A request can span at most 366 calendar days.' }
  const charges: DayCharge[] = []
  if (type.unit === 'hours' && dates.length !== 1)
    return { ok: false, error: 'Hourly leave must start and end on the same date.' }
  for (const date of dates) {
    const periods = periodsForDate(input.employeeId, date, context)
    if (!periods) return { ok: false, error: 'The assigned working schedule is missing. Reassign a schedule first.' }
    const dailyMinutes = periods.reduce((total, slot) => total + slotMinutes(slot), 0)
    if (type.unit === 'days') {
      if (dailyMinutes > 0) charges.push({ date, amount: 1 })
      continue
    }
    const start = timeMinutes(input.startTime)
    const end = timeMinutes(input.endTime)
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      return { ok: false, error: 'Choose valid times with the end after the start on the same day.' }
    if (!dailyMinutes || end - start > dailyMinutes)
      return { ok: false, error: 'Hourly leave cannot exceed the net scheduled working hours for that day.' }
    // Break placement is unknown: conservatively require one scheduled period,
    // plus the daily net-hours cap. Multi-period / overnight requests are separate.
    if (!periods.some(slot => start >= timeMinutes(slot.start) && end <= timeMinutes(slot.end)))
      return { ok: false, error: 'Hourly leave must fit within one scheduled working period.' }
    charges.push({ date, amount: rounded((end - start) / 60) })
  }
  if (!charges.length) return { ok: false, error: 'This range contains no scheduled working days.' }
  return {
    ok: true,
    unit: type.unit,
    duration: rounded(charges.reduce((sum, charge) => sum + charge.amount, 0)),
    charges
  }
}
export function requestsOverlap(
  candidate: Pick<TimeOffRequest, 'employeeId' | 'unit' | 'charges' | 'startTime' | 'endTime'>,
  existing: TimeOffRequest
): boolean {
  if (candidate.employeeId !== existing.employeeId || !['pending', 'approved'].includes(existing.status)) return false
  const sharedDate = candidate.charges.some(charge => existing.charges.some(other => other.date === charge.date))
  return (
    sharedDate &&
    (candidate.unit === 'days' ||
      existing.unit === 'days' ||
      (candidate.startTime < existing.endTime && existing.startTime < candidate.endTime))
  )
}
export function hourlyCapacityError(
  candidate: Pick<TimeOffRequest, 'employeeId' | 'unit' | 'charges'>,
  data: TimeOffData,
  context: ScheduleContext,
  id?: string
): string | null {
  if (candidate.unit !== 'hours') return null
  for (const charge of candidate.charges) {
    const dailyMinutes =
      periodsForDate(candidate.employeeId, charge.date, context)?.reduce((sum, slot) => sum + slotMinutes(slot), 0) || 0
    const otherHours = data.requests
      .filter(
        item =>
          item.id !== id &&
          item.employeeId === candidate.employeeId &&
          item.unit === 'hours' &&
          ['pending', 'approved'].includes(item.status)
      )
      .reduce(
        (sum, item) =>
          sum +
          item.charges
            .filter(other => other.date === charge.date)
            .reduce((subtotal, other) => subtotal + other.amount, 0),
        0
      )
    if (charge.amount + otherHours - dailyMinutes / 60 > EPSILON)
      return `Combined pending and approved hourly leave exceeds the net scheduled hours on ${charge.date}.`
  }
  return null
}

function consumedByAllocation(data: TimeOffData): Map<string, number> {
  const consumed = new Map<string, number>()
  for (const request of data.requests) {
    if (request.status !== 'approved') continue
    for (const item of request.consumptions)
      consumed.set(item.allocationId, rounded((consumed.get(item.allocationId) || 0) + item.amount))
  }
  return consumed
}
export function planConsumption(
  data: TimeOffData,
  employeeId: string,
  typeId: string,
  charges: DayCharge[]
): { ok: true; consumptions: Consumption[] } | { ok: false; error: string } {
  const type = data.types.find(item => item.id === typeId)
  if (!type) return { ok: false, error: 'Choose an existing time off type.' }
  if (!type.requiresAllocation) return { ok: true, consumptions: [] }
  const consumed = consumedByAllocation(data)
  const grants = data.allocations
    .filter(item => item.employeeId === employeeId && item.typeId === typeId && item.status === 'approved')
    .sort(
      (a, b) =>
        (a.validTo || '9999-12-31').localeCompare(b.validTo || '9999-12-31') ||
        a.validFrom.localeCompare(b.validFrom) ||
        a.id.localeCompare(b.id)
    )
  const consumptions: Consumption[] = []
  for (const charge of [...charges].sort((a, b) => a.date.localeCompare(b.date))) {
    let needed = charge.amount
    for (const grant of grants) {
      if (grant.validFrom > charge.date || (grant.validTo && grant.validTo < charge.date)) continue
      const available = rounded(grant.amount - (consumed.get(grant.id) || 0))
      const amount = Math.min(available, needed)
      if (amount <= EPSILON) continue
      consumptions.push({ allocationId: grant.id, date: charge.date, amount: rounded(amount) })
      consumed.set(grant.id, rounded((consumed.get(grant.id) || 0) + amount))
      needed = rounded(needed - amount)
      if (needed <= EPSILON) break
    }
    if (needed > EPSILON)
      return {
        ok: false,
        error: `Insufficient approved allocation on ${charge.date}. ${formatAmount(needed, type.unit)} more required for that date.`
      }
  }
  return { ok: true, consumptions }
}
export function allocationBalance(data: TimeOffData, id: string): Balance {
  const allocation = data.allocations.find(item => item.id === id)
  if (!allocation) return { allocated: 0, taken: 0, remaining: 0, pending: 0 }
  const allocated = allocation.status === 'approved' ? allocation.amount : 0
  const taken = consumedByAllocation(data).get(id) || 0
  return {
    allocated,
    taken,
    remaining: rounded(Math.max(0, allocated - taken)),
    pending: allocation.status === 'pending' ? allocation.amount : 0
  }
}
export function employeeBalance(data: TimeOffData, employeeId: string, typeId: string, asOf = localDate()): Balance {
  const grants = data.allocations.filter(
    item =>
      item.employeeId === employeeId &&
      item.typeId === typeId &&
      item.status === 'approved' &&
      item.validFrom <= asOf &&
      (!item.validTo || item.validTo >= asOf)
  )
  const ids = new Set(grants.map(item => item.id))
  const allocated = rounded(grants.reduce((sum, grant) => sum + grant.amount, 0))
  const consumed = consumedByAllocation(data)
  const type = data.types.find(item => item.id === typeId)
  const taken = rounded(
    type && !type.requiresAllocation
      ? data.requests
          .filter(item => item.employeeId === employeeId && item.typeId === typeId && item.status === 'approved')
          .reduce((sum, item) => sum + item.duration, 0)
      : [...consumed].filter(([id]) => ids.has(id)).reduce((sum, [, amount]) => sum + amount, 0)
  )
  const pending = rounded(
    data.requests
      .filter(item => item.employeeId === employeeId && item.typeId === typeId && item.status === 'pending')
      .reduce((sum, item) => sum + item.duration, 0)
  )
  return {
    allocated,
    taken,
    remaining: rounded(Math.max(0, allocated - (type?.requiresAllocation ? taken : 0))),
    pending
  }
}
export function formatAmount(amount: number, unit: LeaveUnit): string {
  return `${new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(amount)} ${amount === 1 ? unit.slice(0, -1) : unit}`
}
