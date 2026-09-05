import 'server-only'

import type { CalendarEvent } from '@/features/nexacrm/types/apps/calendar-event-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'

// Business-data APIs are not connected yet. Never manufacture records as a fallback.
export const getCalendarEvents = async (): Promise<CalendarEvent[]> => []

export const getCalendarEventsForEntity: (
  entityType: EntityType,
  entityId: string
) => Promise<CalendarEvent[]> = async () => []
