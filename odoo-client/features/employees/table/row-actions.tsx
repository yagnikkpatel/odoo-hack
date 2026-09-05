'use client'

// Third-party Imports
import type { Row, Table } from '@tanstack/react-table'

// Type Imports
import type { Employee } from '@/features/employees/types'
import { employeeName } from '@/features/employees/types'

// Component Imports
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useEmployeesStore } from '@/features/employees/store'

const EmployeeRowActions = ({
  row,
  table,
}: {
  row: Row<Employee>
  table: Table<Employee>
}) => {
  const employee = row.original
  const deleteEmployees = useEmployeesStore((state) => state.deleteEmployees)
  const { can } = useCurrentUser()
  const onEditRow = table.options.meta?.onEditRow

  const name = employeeName(employee)

  return (
    <RowActionShell
      viewHref={`/employees/${employee.id}`}
      onEdit={
        can('records:update') && onEditRow
          ? () => onEditRow(employee)
          : undefined
      }
      label={`Actions for ${name}`}
      onDelete={
        can('records:delete') ? () => deleteEmployees([employee.id]) : undefined
      }
      deleteTitle="Delete employee"
      deleteDescription={
        <>
          Remove <span className="text-foreground font-medium">{name}</span>{' '}
          from the employee directory?
        </>
      }
    />
  )
}

export default EmployeeRowActions
