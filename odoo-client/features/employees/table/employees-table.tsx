'use client'

import type { Table } from '@tanstack/react-table'
import { SearchXIcon, UsersIcon } from 'lucide-react'
import type { Employee } from '../types'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card } from '@/features/nexacrm/components/ui/card'
import DataTable from '@/features/nexacrm/components/data-table/data-table'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import { useEmployeePreview } from '../employee-panel'
import { REORDERABLE_COLUMN_IDS } from './columns'
import EmployeesBulkActions from './bulk-actions'
import EmployeePagination from './employee-pagination'

export function EmployeeEmptyState({ table, isFiltered }: {
  table: Table<Employee>
  isFiltered: boolean
}) {
  if (isFiltered) {
    return (
      <DataTableEmptyState
        icon={SearchXIcon}
        title="No employees match your filters"
        description="Try another search or clear the filters to see the full directory."
        action={
          <Button variant="outline" size="sm" onClick={() => {
            table.setGlobalFilter('')
            table.resetColumnFilters()
          }}>
            Clear filters
          </Button>
        }
      />
    )
  }
  return (
    <DataTableEmptyState
      icon={UsersIcon}
      title="No employees yet"
      description="Employee profiles will appear here after they are created."
    />
  )
}

export default function EmployeesTable({ table, isFiltered, isLoading }: {
  table: Table<Employee>
  isFiltered: boolean
  isLoading: boolean
}) {
  const [, setPreviewId] = useEmployeePreview()
  return (
    <Card className="flex flex-1 flex-col gap-0 overflow-hidden py-0" aria-busy={isLoading}>
      {!isLoading && <EmployeesBulkActions table={table} />}
      <div className="flex flex-1 flex-col [&_[data-slot=table-container]]:border-b">
        <DataTable
          table={table}
          isLoading={isLoading}
          reorderableColumnIds={REORDERABLE_COLUMN_IDS}
          emptyState={<EmployeeEmptyState table={table} isFiltered={isFiltered} />}
          onRowClick={(employee) => setPreviewId(employee.id)}
        />
      </div>
      <div className="border-t">
        <EmployeePagination table={table} isLoading={isLoading} />
      </div>
    </Card>
  )
}
