/** Date-only and datetime-local values stay in the device's time zone, never UTC. */
export function parseDateValue(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined
}

export function dateValue(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isTimeValue(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function dateWithinBounds(value: string, min?: string, max?: string): boolean {
  return !!parseDateValue(value) && (!min || value >= min) && (!max || value <= max)
}

export function withDate(value: string, day: string): string {
  if (!day) return ''
  const time = value.split('T')[1]
  return `${day}T${time && isTimeValue(time) ? time : '09:00'}`
}
