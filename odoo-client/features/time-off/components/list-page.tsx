'use client'
import DataConnectionNotice from '@/features/hr/components/data-connection-notice'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { useRecordsTable } from '@/features/hr/use-records-table'
import RecordsTable from '@/features/hr/components/records-table'
import { useTimeOffStore } from '../store'

export default function TimeOffListPage<TData extends { id: string }>({
  title,
  icon,
  data,
  columns,
  columnIds,
  actions,
  filters,
  onOpen,
  onExport
}: {
  title: string
  icon: LucideIcon
  data: TData[]
  columns: ColumnDef<TData>[]
  columnIds: string[]
  actions?: ReactNode
  filters?: ReactNode
  onOpen: (row: TData) => void
  onExport?: (rows: TData[]) => void
}) {
  const hydrated = useTimeOffStore(state => state.hasHydrated)
  const table = useRecordsTable({ data, columns, columnIds })
  return (
    <div className='flex min-h-full flex-col'>
      <RecordViewBar
        table={table}
        viewName={title}
        count={table.getFilteredRowModel().rows.length}
        icon={icon}
        searchPlaceholder={`Search ${title.toLowerCase()}…`}
        actions={actions}
        options={
          <DataTableViewOptions
            table={table}
            reorderableColumnIds={columnIds}
            onExport={
              onExport ? () => onExport(table.getPrePaginationRowModel().rows.map(row => row.original)) : undefined
            }
          />
        }
      />
      <div className={PAGE_BODY}>
        <DataConnectionNotice />
        <div className='flex flex-wrap items-end gap-3'>
          {filters}
        </div>
        <RecordsTable
          table={table}
          columnIds={columnIds}
          loading={!hydrated}
          onOpen={onOpen}
          label={title.toLowerCase()}
        />
      </div>
    </div>
  )
}
