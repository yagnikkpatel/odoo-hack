// Type Imports
import type { RecordRef } from '@/features/nexacrm/types/apps/record-ref'

export type CalendarEvent = RecordRef & {
  id: string
  title: string
  startAt: string
  endAt?: string
  location?: string
  organizerId?: string
  attendeePersonIds?: string[]
  createdAt: string
}

export const isUpcomingEvent = (event: Pick<CalendarEvent, 'startAt'>): boolean =>
  event.startAt >= new Date().toISOString()
