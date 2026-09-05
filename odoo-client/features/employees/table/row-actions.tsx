'use client'

import { useState } from 'react'
import type { Row, Table } from '@tanstack/react-table'
import { Trash2Icon } from 'lucide-react'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { DropdownMenuItem } from '@/features/nexacrm/components/ui/dropdown-menu'
import type { Employee } from '../types'
import { employeeName } from '../types'
import { useEmployeePermissions } from '../permissions'
import EmployeeDeleteDialog from './employee-delete-dialog'

export default function EmployeeRowActions({ row, table }: {
  row: Row<Employee>
  table: Table<Employee>
}) {
  const employee = row.original
  const { canUpdate, canDelete } = useEmployeePermissions()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const onEditRow = table.options.meta?.onEditRow
  let onEdit: (() => void) | undefined
  let deleteAction = null
  if (canUpdate && onEditRow) onEdit = () => onEditRow(employee)
  if (canDelete) {
    deleteAction = (
      <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
        <Trash2Icon /> Delete
      </DropdownMenuItem>
    )
  }

  return (
    <>
      <RowActionShell
        viewHref={'/employees/' + employee.id}
        onEdit={onEdit}
        label={'Actions for ' + employeeName(employee)}
        extraItems={deleteAction}
      />
      <EmployeeDeleteDialog open={confirmOpen} onOpenChange={setConfirmOpen}
        employees={[employee]} onDeleted={() => table.resetRowSelection()} />
    </>
  )
}
