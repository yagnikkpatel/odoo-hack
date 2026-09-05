'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import RecordCalendar from '@/features/nexacrm/components/calendar/record-calendar'

// Local Imports
import PersonCalendarCard from './person-calendar-card'

const PeopleCalendar = ({ table, onOpenRecord }: { table: Table<Person>; onOpenRecord: (id: string) => void }) => (
  <RecordCalendar
    table={table}
    testId='people-calendar'
    getId={person => person.id}
    getDate={person => person.createdAt}
    getTitle={person => personDisplayName(person)}
    getMeta={person => person.jobTitle || undefined}
    isUntitled={person => !person.firstName && !person.lastName}
    renderCard={person => (
      <PersonCalendarCard
        person={person}
        onClick={() => onOpenRecord(person.id)}
        className='hover:ring-primary/40 cursor-pointer transition-colors'
      />
    )}
  />
)

export default PeopleCalendar
