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
import { usePayrollStore } from '../store'
import usePayrollData from './use-payroll-data'

export function AccessDenied({ children = 'Your role does not have access to payroll.' }: { children?: ReactNode }) {
  return (
    <p role='alert' className='text-muted-foreground py-12 text-sm'>
      {children}
    </p>
  )
}

export default function PayrollListPage<TData extends { id: string }>({
  title,
  icon,
  data,
  columns,
  columnIds,
  actions,
  filters,
  hint,
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
  hint?: ReactNode
  onOpen: (row: TData) => void
  onExport?: (rows: TData[]) => void
}) {
  usePayrollData()
  const hydrated = usePayrollStore(state => state.hasHydrated)
  const error = usePayrollStore(state => state.error)
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
        {error && (
          <div
            role='status'
            className='bg-muted/30 text-muted-foreground flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm'
          >
            <DatabaseIcon className='mt-0.5 size-4 shrink-0' />
            <p>{error}</p>
          </div>
        )}
        {(filters || hint) && (
          <div className='flex flex-wrap items-end justify-between gap-3'>
            <div className='flex flex-wrap items-end gap-3'>{filters}</div>
            {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
          </div>
        )}
        <RecordsTable table={table} columnIds={columnIds} loading={!hydrated} onOpen={onOpen} label={title.toLowerCase()} />
      </div>
    </div>
  )
}
