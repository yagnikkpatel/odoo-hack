'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { SearchXIcon, UsersIcon } from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card } from '@/features/nexacrm/components/ui/card'
import DataTable from '@/features/nexacrm/components/data-table/data-table'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import DataTablePagination from '@/features/nexacrm/components/data-table/data-table-pagination'

// Store Imports
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'

// Local Imports
import { usePersonPreview } from '../people-panel'
import { REORDERABLE_COLUMN_IDS } from './columns'
import PeopleBulkActions from './people-bulk-actions'
import PeopleTableFooter from './people-footer'

type PeopleTableProps = {
  table: Table<Person>
  rowCount: number
  isFiltered: boolean
  showSummary: boolean
}

const PeopleTable = ({ table, rowCount, isFiltered, showSummary }: PeopleTableProps) => {
  const [, setPreviewId] = usePersonPreview()
  const hasHydrated = usePeopleStore(state => state.hasHydrated)

  const emptyState = isFiltered ? (
    <DataTableEmptyState
      icon={SearchXIcon}
      title='No people match your filters'
      description='Try a different search term, or clear the filters to see the full list.'
      action={
        <Button
          variant='outline'
          size='sm'
          onClick={() => {
            table.setGlobalFilter('')
            table.resetColumnFilters()
          }}
        >
          Clear filters
        </Button>
      }
    />
  ) : (
    <DataTableEmptyState
      icon={UsersIcon}
      title='No people yet'
      description='Add the first person to start tracking who you deal with at each company.'
    />
  )

  return (
    <Card className='flex flex-1 flex-col gap-0 overflow-hidden py-0'>
      <PeopleBulkActions table={table} />
      <div className='flex flex-1 flex-col'>
        <DataTable
          table={table}
          isLoading={!hasHydrated}
          reorderableColumnIds={REORDERABLE_COLUMN_IDS}
          emptyState={emptyState}
          onRowClick={person => setPreviewId(person.id)}
          footer={showSummary && rowCount ? <PeopleTableFooter table={table} /> : null}
        />
      </div>
      <div className='border-t'>
        <DataTablePagination table={table} idPrefix='people' noun='person' nounPlural='people' />
      </div>
    </Card>
  )
}

export default PeopleTable
