// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { CalendarEvent } from '@/features/nexacrm/types/apps/calendar-event-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'
import { matchesRef } from '@/features/nexacrm/types/apps/record-ref'

type CalendarEventsData = {
  events: CalendarEvent[]
  hasHydrated: boolean
}

type CalendarEventsActions = {
  initialize: (events: CalendarEvent[]) => void
}

export type CalendarEventsStore = CalendarEventsData & CalendarEventsActions

export const useCalendarEventsStore = create<CalendarEventsStore>()(set => ({
  events: [],
  hasHydrated: false,
  initialize: events => set({ events, hasHydrated: true })
}))

export const useEntityCalendarEvents = (entityType: EntityType, entityId: string): CalendarEvent[] => {
  const events = useCalendarEventsStore(state => state.events)

  return useMemo(() => events.filter(event => matchesRef(event, entityType, entityId)), [events, entityType, entityId])
}
