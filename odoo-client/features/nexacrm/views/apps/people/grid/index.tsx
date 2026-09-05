'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { UsersIcon } from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'

// Local Imports
import PersonCard from './person-card'

/*
 * ! `getPrePaginationRowModel()` - this grid renders no pager, so `getRowModel()` would hide every
 * ! row past page 1. See the row-model note in `components/calendar/record-calendar`.
 */
const PeopleGrid = ({ table, onOpenRecord }: { table: Table<Person>; onOpenRecord: (id: string) => void }) => {
  const rows = table.getPrePaginationRowModel().rows

  if (rows.length === 0) {
    return (
      <DataTableEmptyState
        icon={UsersIcon}
        title='No people match'
        description='Clear the search or filters to see everyone again.'
      />
    )
  }

  return (
    <ul data-testid='people-grid' className='grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4'>
      {rows.map(row => (
        <PersonCard key={row.original.id} person={row.original} onOpen={() => onOpenRecord(row.original.id)} />
      ))}
    </ul>
  )
}

export default PeopleGrid
