// Type Imports
import type { CalendarEvent } from '@/features/nexacrm/types/apps/calendar-event-types'

export type CalendarEventSeed = Omit<CalendarEvent, 'createdAt' | 'startAt' | 'endAt'> & {
  startInMinutes: number
  durationMinutes?: number
  createdMinutesAgo: number
}

export const db: CalendarEventSeed[] = [
  {
    id: 'evt_1',
    entityType: 'company',
    entityId: 'cmp_1',
    title: 'Technical deep-dive',
    location: 'Google Meet',
    organizerId: 'usr_3',
    attendeePersonIds: ['per_1'],
    startInMinutes: 60 * 26,
    durationMinutes: 60,
    createdMinutesAgo: 60 * 24
  },
  {
    id: 'evt_2',
    entityType: 'company',
    entityId: 'cmp_1',
    title: 'Quarterly business review',
    location: 'San Francisco, CA',
    organizerId: 'usr_1',
    attendeePersonIds: ['per_1'],
    startInMinutes: 60 * 24 * 6,
    durationMinutes: 90,
    createdMinutesAgo: 60 * 12
  },
  {
    id: 'evt_3',
    entityType: 'company',
    entityId: 'cmp_1',
    title: 'Implementation kickoff',
    location: 'Zoom',
    organizerId: 'usr_3',
    startInMinutes: -60 * 24 * 2,
    durationMinutes: 45,
    createdMinutesAgo: 60 * 24 * 3
  },
  {
    id: 'evt_4',
    entityType: 'company',
    entityId: 'cmp_2',
    title: 'Expansion planning call',
    location: 'Google Meet',
    organizerId: 'usr_1',
    attendeePersonIds: ['per_2'],
    startInMinutes: 60 * 24 * 2,
    durationMinutes: 30,
    createdMinutesAgo: 60 * 6
  },
  {
    id: 'evt_5',
    entityType: 'company',
    entityId: 'cmp_3',
    title: 'Payments scoping workshop',
    location: 'Zoom',
    organizerId: 'usr_1',
    startInMinutes: 60 * 24 * 4,
    durationMinutes: 60,
    createdMinutesAgo: 60 * 10
  },

  {
    id: 'evt_6',
    entityType: 'person',
    entityId: 'per_1',
    title: 'Security sign-off review',
    location: 'Google Meet',
    organizerId: 'usr_3',
    attendeePersonIds: ['per_1'],
    startInMinutes: 60 * 30,
    durationMinutes: 45,
    createdMinutesAgo: 60 * 8
  },
  {
    id: 'evt_7',
    entityType: 'person',
    entityId: 'per_2',
    title: 'Proposal walkthrough',
    location: 'Zoom',
    organizerId: 'usr_1',
    attendeePersonIds: ['per_2'],
    startInMinutes: 60 * 18,
    durationMinutes: 45,
    createdMinutesAgo: 60 * 12
  },
  {
    id: 'evt_8',
    entityType: 'person',
    entityId: 'per_3',
    title: 'Payments discovery call',
    location: 'Google Meet',
    organizerId: 'usr_1',
    attendeePersonIds: ['per_3'],
    startInMinutes: -60 * 20,
    durationMinutes: 30,
    createdMinutesAgo: 60 * 40
  },
  {
    id: 'evt_9',
    entityType: 'person',
    entityId: 'per_4',
    title: 'Design ops renewal call',
    location: 'Google Meet',
    organizerId: 'usr_2',
    attendeePersonIds: ['per_4'],
    startInMinutes: 60 * 10,
    durationMinutes: 30,
    createdMinutesAgo: 60 * 4
  },
  {
    id: 'evt_10',
    entityType: 'person',
    entityId: 'per_5',
    title: 'Pilot kickoff',
    location: 'Notion HQ',
    organizerId: 'usr_4',
    attendeePersonIds: ['per_5'],
    startInMinutes: 60 * 52,
    durationMinutes: 60,
    createdMinutesAgo: 60 * 21
  }
]
