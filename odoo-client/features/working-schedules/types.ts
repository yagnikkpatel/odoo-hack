export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const
export const SCHEDULE_TYPES = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  shift: 'Shift',
}
export type ScheduleSlot = {
  day: number
  start: string
  end: string
  breakMinutes: number
}
export type ScheduleInput = {
  name: string
  type: keyof typeof SCHEDULE_TYPES
  slots: ScheduleSlot[]
}
export type WorkingSchedule = ScheduleInput & { id: string; updatedAt: string }
export type ScheduleRow = WorkingSchedule & {
  weeklyMinutes: number
  employeeCount: number
}
export const timeMinutes = (value: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}
export const slotMinutes = (slot: ScheduleSlot) =>
  timeMinutes(slot.end) - timeMinutes(slot.start) - slot.breakMinutes
export const weeklyMinutes = (schedule: ScheduleInput) =>
  schedule.slots.reduce((total, slot) => total + slotMinutes(slot), 0)
export function validateSchedule(input: ScheduleInput): string | null {
  if (!input.name.trim()) return 'Enter a schedule name.'
  if (!(input.type in SCHEDULE_TYPES)) return 'Choose a valid schedule type.'
  if (!input.slots.length) return 'Add at least one working period.'
  for (const slot of input.slots) {
    if (!Number.isInteger(slot.day) || slot.day < 0 || slot.day > 6)
      return 'Choose a valid day.'
    if (
      !Number.isFinite(timeMinutes(slot.start)) ||
      !Number.isFinite(timeMinutes(slot.end)) ||
      timeMinutes(slot.end) <= timeMinutes(slot.start)
    )
      return 'End time must be after start time on the same day. Overnight schedule periods are not supported in this preview.'
    if (
      !Number.isInteger(slot.breakMinutes) ||
      slot.breakMinutes < 0 ||
      slotMinutes(slot) <= 0
    )
      return 'Break must be a whole number of minutes shorter than the working period.'
  }
  if (
    input.slots.some((slot, index) =>
      input.slots.some(
        (other, otherIndex) =>
          index !== otherIndex &&
          slot.day === other.day &&
          slot.start < other.end &&
          other.start < slot.end,
      ),
    )
  )
    return 'Working periods on the same day cannot overlap.'
  return null
}
