'use client'
import { DATA_API_CONNECTED, DATA_CONNECTION_MESSAGE } from '../data-availability'
import type { Table } from '@tanstack/react-table'
import { SearchXIcon } from 'lucide-react'
import { Card } from '@/features/nexacrm/components/ui/card'
import DataTable from '@/features/nexacrm/components/data-table/data-table'
import DataTablePagination from '@/features/nexacrm/components/data-table/data-table-pagination'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'

export default function RecordsTable<T>({
  table,
  columnIds,
  loading,
  onOpen,
  label,
  noun,
}: {
  table: Table<T>
  columnIds: string[]
  loading: boolean
  onOpen: (record: T) => void
  /** Plural record name, used for the empty state and the footer count. */
  label: string
  /** Singular form of `label` for the footer count. */
  noun: string
}) {
  return (
    <Card className="flex flex-1 flex-col gap-0 overflow-hidden py-0">
      <div className="flex flex-1 flex-col [&_[data-slot=table-container]]:border-b">
        <DataTable
          table={table}
          isLoading={loading}
          reorderableColumnIds={columnIds}
          onRowClick={onOpen}
          emptyState={
            <DataTableEmptyState
              icon={SearchXIcon}
              title={`No ${label} to show`}
              description={DATA_API_CONNECTED ? 'Adjust your search and filters.' : DATA_CONNECTION_MESSAGE}
            />
          }
        />
      </div>
      <div className="border-t">
        <DataTablePagination
          table={table}
          showSelectionCount={false}
          idPrefix={label.replaceAll(' ', '-')}
          noun={noun}
          nounPlural={label}
        />
      </div>
    </Card>
  )
}
