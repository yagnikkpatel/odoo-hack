'use client'

// Third-party Imports
import { format, isToday, isTomorrow } from 'date-fns'
import { CalendarIcon, MapPinIcon, VideoIcon } from 'lucide-react'

// Type Imports
import type { CalendarEvent } from '@/features/nexacrm/types/apps/calendar-event-types'
import { isUpcomingEvent } from '@/features/nexacrm/types/apps/calendar-event-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'

// Component Imports
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import RecordPanelLoader from '@/features/nexacrm/components/record/record-panel-loader'
import { RecordHeading, RecordSubHeading } from '@/features/nexacrm/components/record/record-section'

// Store Imports
import { useCalendarEventsStore, useEntityCalendarEvents } from '@/features/nexacrm/store/use-calendar-events-store'
import { useUser } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

const relativeLabel = (date: Date) => (isToday(date) ? 'Today' : isTomorrow(date) ? 'Tomorrow' : null)

const EventRow = ({ event }: { event: CalendarEvent }) => {
  const organizer = useUser(event.organizerId)
  const start = new Date(event.startAt)
  const past = !isUpcomingEvent(event)
  const relative = relativeLabel(start)

  const time = event.endAt
    ? `${format(start, 'HH:mm')} – ${format(new Date(event.endAt), 'HH:mm')}`
    : format(start, 'HH:mm')

  const isVirtual = /zoom|meet|teams|webex|hangout/i.test(event.location ?? '')

  return (
    <li className={cn('flex items-center gap-3 rounded-lg border p-3', past && 'opacity-60')}>
      <span className='bg-muted flex size-11 shrink-0 flex-col items-center justify-center rounded-md leading-none'>
        <span className='text-muted-foreground text-[10px] font-medium uppercase'>{format(start, 'EEE')}</span>
        <span className='text-sm font-semibold tabular-nums'>{format(start, 'd')}</span>
      </span>

      <div className='min-w-0 flex-1'>
        <p className='truncate text-sm font-medium'>{event.title}</p>
        <p className='text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs'>
          {relative ? <span className='text-foreground font-medium'>{relative}</span> : null}
          <span className='tabular-nums'>
            {format(start, 'MMM d, yyyy')} · {time}
          </span>
        </p>
        {event.location ? (
          <p className='text-muted-foreground mt-0.5 flex items-center gap-1 text-xs'>
            {isVirtual ? <VideoIcon className='size-3 shrink-0' /> : <MapPinIcon className='size-3 shrink-0' />}
            <span className='truncate'>{event.location}</span>
          </p>
        ) : null}
      </div>

      {organizer ? (
        <span className='flex shrink-0 items-center gap-2'>
          <PersonAvatar
            name={organizer.name}
            src={organizer.avatar}
            className='size-6'
            fallbackClassName='text-[10px]'
          />
          <span className='text-muted-foreground text-xs max-sm:hidden'>{organizer.name}</span>
        </span>
      ) : null}
    </li>
  )
}

const EventGroup = ({ title, events }: { title: string; events: CalendarEvent[] }) =>
  events.length > 0 ? (
    <section>
      <RecordSubHeading title={title} count={events.length} />
      <ul className='space-y-2'>
        {events.map(event => (
          <EventRow key={event.id} event={event} />
        ))}
      </ul>
    </section>
  ) : null

const CalendarPanel = ({ entityType, entityId }: { entityType: EntityType; entityId: string }) => {
  const events = useEntityCalendarEvents(entityType, entityId)
  const hasHydrated = useCalendarEventsStore(state => state.hasHydrated)

  if (!hasHydrated) return <RecordPanelLoader />

  const upcoming = events.filter(isUpcomingEvent).sort((a, b) => a.startAt.localeCompare(b.startAt))
  const past = events.filter(event => !isUpcomingEvent(event)).sort((a, b) => b.startAt.localeCompare(a.startAt))

  return (
    <div className='space-y-3'>
      <RecordHeading title='Calendar' count={events.length} />

      {events.length > 0 ? (
        <div className='space-y-4'>
          <EventGroup title='Upcoming' events={upcoming} />
          <EventGroup title='Past' events={past} />
        </div>
      ) : (
        <DataTableEmptyState
          icon={CalendarIcon}
          title='No meetings yet'
          description='Connect a calendar to sync meetings with people at this record.'
        />
      )}
    </div>
  )
}

export default CalendarPanel
