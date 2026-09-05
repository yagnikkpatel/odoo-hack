'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { SearchXIcon, UsersIcon } from 'lucide-react'

// Type Imports
import type { Employee } from '@/features/employees/types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card } from '@/features/nexacrm/components/ui/card'
import DataTable from '@/features/nexacrm/components/data-table/data-table'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import DataTablePagination from '@/features/nexacrm/components/data-table/data-table-pagination'

// Store Imports
import { useEmployeesStore } from '@/features/employees/store'

// Local Imports
import { useEmployeePreview } from '../employee-panel'
import { REORDERABLE_COLUMN_IDS } from './columns'
import EmployeesBulkActions from './bulk-actions'

type EmployeesTableProps = {
  table: Table<Employee>
  isFiltered: boolean
}

const EmployeesTable = ({ table, isFiltered }: EmployeesTableProps) => {
  const [, setPreviewId] = useEmployeePreview()
  const hasHydrated = useEmployeesStore((state) => state.hasHydrated)

  const emptyState = isFiltered ? (
    <DataTableEmptyState
      icon={SearchXIcon}
      title="No employees match your filters"
      description="Try a different search term, or clear the filters to see the full list."
      action={
        <Button
          variant="outline"
          size="sm"
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
      title="No employees yet"
      description="Add an employee to start building your employee directory."
    />
  )

  return (
    <Card className="flex flex-1 flex-col gap-0 overflow-hidden py-0">
      <EmployeesBulkActions table={table} />
      {/* Keep the row boundary when the removed summary footer leaves empty card space. */}
      <div className="flex flex-1 flex-col [&_[data-slot=table-container]]:border-b">
        <DataTable
          table={table}
          isLoading={!hasHydrated}
          reorderableColumnIds={REORDERABLE_COLUMN_IDS}
          emptyState={emptyState}
          onRowClick={(employee) => setPreviewId(employee.id)}
        />
      </div>
      <div className="border-t">
        <DataTablePagination table={table} idPrefix="employees" />
      </div>
    </Card>
  )
}

export default EmployeesTable
