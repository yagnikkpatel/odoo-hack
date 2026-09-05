// Third-party Imports
import { differenceInCalendarDays, format, formatDistanceToNowStrict, isYesterday } from 'date-fns'

export const formatActivityTime = (iso: string): string => {
  const date = new Date(iso)

  if (isYesterday(date)) return `Yesterday · ${format(date, 'HH:mm')}`

  if (differenceInCalendarDays(new Date(), date) > 7) return format(date, 'MMM d, yyyy')

  const distance = formatDistanceToNowStrict(date, { addSuffix: true })

  return distance.charAt(0).toUpperCase() + distance.slice(1)
}
