'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { SearchXIcon, TargetIcon } from 'lucide-react'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card } from '@/features/nexacrm/components/ui/card'
import DataTable from '@/features/nexacrm/components/data-table/data-table'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import DataTablePagination from '@/features/nexacrm/components/data-table/data-table-pagination'

// Store Imports
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'

// Local Imports
import { useOpportunityPreview } from '../opportunity-panel'
import { REORDERABLE_COLUMN_IDS } from './columns'
import OpportunitiesBulkActions from './opportunities-bulk-actions'
import OpportunitiesTableFooter from './opportunities-footer'

type OpportunitiesTableProps = {
  table: Table<Opportunity>
  rowCount: number
  isFiltered: boolean
  showSummary: boolean
}

const OpportunitiesTable = ({ table, rowCount, isFiltered, showSummary }: OpportunitiesTableProps) => {
  const [, setPreviewId] = useOpportunityPreview()
  const hasHydrated = useOpportunitiesStore(state => state.hasHydrated)

  const emptyState = isFiltered ? (
    <DataTableEmptyState
      icon={SearchXIcon}
      title='No opportunities match your filters'
      description='Try a different search term, or clear the filters to see the whole pipeline.'
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
      icon={TargetIcon}
      title='No opportunities yet'
      description='Create the first opportunity to start tracking what is riding on your accounts.'
    />
  )

  return (
    <Card className='flex flex-1 flex-col gap-0 overflow-hidden py-0'>
      <OpportunitiesBulkActions table={table} />
      <div className='flex flex-1 flex-col'>
        <DataTable
          table={table}
          isLoading={!hasHydrated}
          reorderableColumnIds={REORDERABLE_COLUMN_IDS}
          emptyState={emptyState}
          onRowClick={opportunity => setPreviewId(opportunity.id)}
          footer={showSummary && rowCount ? <OpportunitiesTableFooter table={table} /> : null}
        />
      </div>
      <div className='border-t'>
        <DataTablePagination table={table} idPrefix='opportunities' />
      </div>
    </Card>
  )
}

export default OpportunitiesTable
