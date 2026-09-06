'use client'

import type { ReactNode } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import { DatabaseIcon } from 'lucide-react'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { useRecordsTable } from '@/features/hr/use-records-table'
import RecordsTable from '@/features/hr/components/records-table'
import { useTimeOffStore } from '../store'
import useTimeOffData from './use-time-off-data'
import { useTimeOffPermissions } from '../permissions'

export default function TimeOffListPage<TData extends { id: string }>({
  title,
  noun,
  icon,
  data,
  columns,
  columnIds,
  actions,
  filters,
  onOpen,
  onExport,
  showFilter,
  showFilterFieldLabels
}: {
  title: string
  /** Singular record name for the table footer count, e.g. "request". */
  noun: string
  icon: LucideIcon
  data: TData[]
  columns: ColumnDef<TData>[]
  columnIds: string[]
  actions?: ReactNode
  filters?: ReactNode
  onOpen: (row: TData) => void
  onExport?: (rows: TData[]) => void
  showFilter?: boolean
  showFilterFieldLabels?: boolean
}) {
  useTimeOffData()
  const { canReadOwn, canReadAny } = useTimeOffPermissions()
  const hydrated = useTimeOffStore(state => state.hasHydrated)
  const error = useTimeOffStore(state => state.error)
  const table = useRecordsTable({ data, columns, columnIds })
  if (!canReadOwn && !canReadAny) return <p role="alert" className="py-12 text-muted-foreground">You do not have access to time off.</p>
  return (
    <div className='flex min-h-full flex-col'>
      <RecordViewBar
        table={table}
        viewName={title}
        count={table.getFilteredRowModel().rows.length}
        icon={icon}
        showSort={false}
        showSearch
        searchPlaceholder={`Search ${title.toLowerCase()}…`}
        showFilter={showFilter}
        showFilterFieldLabels={showFilterFieldLabels}
        actions={actions}
        options={
          <DataTableViewOptions
            table={table}
            reorderableColumnIds={columnIds}
            showCopyLink={false}
            onExport={
              onExport ? () => onExport(table.getPrePaginationRowModel().rows.map(row => row.original)) : undefined
            }
          />
        }
      />
      <div className={PAGE_BODY}>
        {error && (
          <div
            role='status'
            className='bg-muted/30 text-muted-foreground flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm'
          >
            <DatabaseIcon className='mt-0.5 size-4 shrink-0' />
            <p>{error}</p>
          </div>
        )}
        <div className='flex flex-wrap items-end gap-3'>
          {filters}
        </div>
        <RecordsTable
          table={table}
          columnIds={columnIds}
          loading={!hydrated}
          onOpen={onOpen}
          label={title.toLowerCase()}
          noun={noun}
        />
      </div>
    </div>
  )
}
