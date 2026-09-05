'use client'

import type { ReactNode } from 'react'
import type { Table } from '@tanstack/react-table'
import { UsersIcon } from 'lucide-react'
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import type { RecordViewType } from '@/features/nexacrm/components/data-table/record-view-bar'
import { EMPLOYEE_VIEW_TYPES } from '../types'
import type { Employee } from '../types'
import { downloadEmployeesCsv } from '../csv'
import { REORDERABLE_COLUMN_IDS } from './columns'

export default function EmployeesToolbar({
  table,
  count,
  viewType,
  onViewTypeChange,
  actions,
  isLoading,
}: {
  table: Table<Employee>
  count: number
  viewType: RecordViewType
  onViewTypeChange: (view: RecordViewType) => void
  actions: ReactNode
  isLoading: boolean
}) {
  let exportCurrentPage: (() => void) | undefined
  if (!isLoading && table.getRowModel().rows.length > 0) {
    exportCurrentPage = () => {
      downloadEmployeesCsv(table.getRowModel().rows.map((row) => row.original))
    }
  }

  return (
    <RecordViewBar
      table={table}
      viewName="Employees"
      count={count}
      icon={UsersIcon}
      searchPlaceholder="Search employees…"
      actions={actions}
      viewType={viewType}
      onViewTypeChange={onViewTypeChange}
      viewTypes={EMPLOYEE_VIEW_TYPES}
      showSort={false}
      showSearch={false}
      showFilterFieldLabels={false}
      showFilterChips={false}
      options={
        <DataTableViewOptions
          table={table}
          reorderableColumnIds={REORDERABLE_COLUMN_IDS}
          showCopyLink={false}
          onExport={exportCurrentPage}
          exportLabel="Export current page to CSV"
        />
      }
    />
  )
}
