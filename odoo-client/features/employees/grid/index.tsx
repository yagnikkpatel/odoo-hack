'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { UsersIcon } from 'lucide-react'

// Type Imports
import type { Employee } from '@/features/employees/types'

// Component Imports
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'

// Local Imports
import EmployeeCard from './employee-card'

/*
 * ! `getPrePaginationRowModel()` - this grid renders no pager, so `getRowModel()` would hide every
 * ! row past page 1. See the row-model note in `components/calendar/record-calendar`.
 */
const EmployeesGrid = ({
  table,
  onOpenRecord,
}: {
  table: Table<Employee>
  onOpenRecord: (id: string) => void
}) => {
  const rows = table.getPrePaginationRowModel().rows

  if (rows.length === 0) {
    return (
      <DataTableEmptyState
        icon={UsersIcon}
        title="No employees to show"
        description="Employee records will appear after the data connection is configured."
      />
    )
  }

  return (
    <ul
      data-testid="employees-grid"
      className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4"
    >
      {rows.map((row) => (
        <EmployeeCard
          key={row.original.id}
          employee={row.original}
          onOpen={() => onOpenRecord(row.original.id)}
        />
      ))}
    </ul>
  )
}

export default EmployeesGrid
