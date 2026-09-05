'use client'

// React Imports
import type { ReactNode } from 'react'

// Third-party Imports
import type { Table } from '@tanstack/react-table'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import { TableCell, TableFooter, TableRow } from '@/features/nexacrm/components/ui/table'

// Util Imports
import { formatCompactCurrency, formatDate } from '@/features/nexacrm/utils/format'

const OpportunitiesTableFooter = ({ table }: { table: Table<Opportunity> }) => {
  const rows = table.getFilteredRowModel().rows.map(row => row.original)

  const total = rows.reduce((sum, opportunity) => sum + opportunity.amount, 0)

  const closeDates = rows.map(opportunity => opportunity.closeDate).filter((date): date is string => Boolean(date))

  const earliest = closeDates.length ? closeDates.reduce((min, date) => (date < min ? date : min)) : undefined

  return (
    <TableFooter className='bg-background'>
      <TableRow className='hover:bg-transparent'>
        {table.getVisibleLeafColumns().map(column => {
          let content: ReactNode = null

          if (column.id === 'name') {
            content = (
              <span className='text-muted-foreground text-xs font-normal'>
                {rows.length} {rows.length === 1 ? 'opportunity' : 'opportunities'}
              </span>
            )
          } else if (column.id === 'amount') {
            content = (
              <span className='text-muted-foreground text-xs font-normal tabular-nums'>
                {formatCompactCurrency(total)}
              </span>
            )
          } else if (column.id === 'closeDate' && earliest) {
            content = (
              <span className='text-muted-foreground text-xs font-normal whitespace-nowrap'>
                {formatDate(earliest)}
              </span>
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

export default OpportunitiesTableFooter
