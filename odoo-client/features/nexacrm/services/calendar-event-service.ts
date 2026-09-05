import 'server-only'

// Type Imports
import type { CalendarEvent } from '@/features/nexacrm/types/apps/calendar-event-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'

// Data Imports
import { db } from '@/features/nexacrm/fake-db/apps/calendar-events'

const minutesToIso = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

const toEvent = ({
  startInMinutes,
  durationMinutes,
  createdMinutesAgo,
  ...event
}: (typeof db)[number]): CalendarEvent => ({
  ...event,
  startAt: minutesToIso(startInMinutes),
  endAt: durationMinutes === undefined ? undefined : minutesToIso(startInMinutes + durationMinutes),
  createdAt: minutesToIso(-createdMinutesAgo)
})

export const getCalendarEvents = async (): Promise<CalendarEvent[]> => {
  return db.map(toEvent)
}

export const getCalendarEventsForEntity = async (
  entityType: EntityType,
  entityId: string
): Promise<CalendarEvent[]> => {
  return db.filter(event => event.entityType === entityType && event.entityId === entityId).map(toEvent)
}
