'use client'
import { useState } from 'react'
import type { Table } from '@tanstack/react-table'
import { DownloadIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import BulkActionBar from '@/features/nexacrm/components/data-table/bulk-action-bar'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import type { Employee } from '../types'
import { useEmployeesStore } from '../store'
import { downloadEmployeesCsv } from '../csv'

export default function EmployeesBulkActions({
  table,
}: {
  table: Table<Employee>
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const remove = useEmployeesStore((state) => state.deleteEmployees)
  const { can } = useCurrentUser()
  const selected = table
    .getFilteredSelectedRowModel()
    .rows.map((row) => row.original)
  return (
    <BulkActionBar table={table}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadEmployeesCsv(selected)}
      >
        <DownloadIcon /> Export
      </Button>
      {can('records:delete') && (
        <>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2Icon /> Delete
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={'Delete ' + selected.length + ' employees?'}
            description="Remove these employees from the demo directory? Their manager links will be cleared. This does not change the separate CRM preview."
            confirmLabel="Delete"
            onConfirm={() => {
              remove(selected.map((employee) => employee.id))
              table.resetRowSelection()
            }}
          />
        </>
      )}
    </BulkActionBar>
  )
}
