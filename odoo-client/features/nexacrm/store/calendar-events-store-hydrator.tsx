'use client'

// React Imports
import { useEffect } from 'react'

// Type Imports
import type { CalendarEvent } from '@/features/nexacrm/types/apps/calendar-event-types'

// Store Imports
import { useCalendarEventsStore } from '@/features/nexacrm/store/use-calendar-events-store'

const CalendarEventsStoreHydrator = ({ data }: { data: CalendarEvent[] }) => {
  useEffect(() => {
    useCalendarEventsStore.getState().initialize(data)
  }, [data])

  return null
}

export default CalendarEventsStoreHydrator
