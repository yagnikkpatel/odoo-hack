'use client'

// React Imports
import type { ReactNode } from 'react'

// Third-party Imports
import type { Table } from '@tanstack/react-table'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { TableCell, TableFooter, TableRow } from '@/features/nexacrm/components/ui/table'

const PeopleTableFooter = ({ table }: { table: Table<Person> }) => {
  const people = table.getFilteredRowModel().rows.map(row => row.original)
  const count = people.length

  const withEmail = people.filter(person => person.email.trim()).length
  const withPhone = people.filter(person => person.phone?.trim()).length

  const percent = (part: number) => (count === 0 ? '-' : `${Math.round((part / count) * 100)}%`)

  return (
    <TableFooter className='bg-background'>
      <TableRow className='hover:bg-transparent'>
        {table.getVisibleLeafColumns().map(column => {
          let content: ReactNode = null

          if (column.id === 'name') {
            content = <span className='text-muted-foreground text-xs font-normal'>{count} people</span>
          } else if (column.id === 'email') {
            content = (
              <span className='text-muted-foreground block text-xs tabular-nums'>{percent(withEmail)} filled</span>
            )
          } else if (column.id === 'phone') {
            content = (
              <span className='text-muted-foreground block text-xs tabular-nums'>{percent(withPhone)} filled</span>
            )
          }

          return (
            <TableCell key={column.id} className='px-3 py-2.5'>
              {content}
            </TableCell>
          )
        })}
      </TableRow>
    </TableFooter>
  )
}

export default PeopleTableFooter
