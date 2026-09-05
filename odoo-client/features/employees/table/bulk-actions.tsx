'use client'

import { useState } from 'react'
import type { Table } from '@tanstack/react-table'
import { DownloadIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import BulkActionBar from '@/features/nexacrm/components/data-table/bulk-action-bar'
import type { Employee } from '../types'
import { useEmployeePermissions } from '../permissions'
import { downloadEmployeesCsv } from '../csv'
import EmployeeDeleteDialog from './employee-delete-dialog'

export default function EmployeesBulkActions({ table }: { table: Table<Employee> }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { canDelete } = useEmployeePermissions()
  const selected = table.getSelectedRowModel().rows.map((row) => row.original)

  return (
    <BulkActionBar table={table}>
      <Button variant="outline" size="sm" onClick={() => downloadEmployeesCsv(selected, 'employees-selected.csv')}>
        <DownloadIcon /> Export selected
      </Button>
      {canDelete && (
        <>
          <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
            <Trash2Icon /> Delete
          </Button>
          <EmployeeDeleteDialog open={confirmOpen} onOpenChange={setConfirmOpen}
            employees={selected} onDeleted={() => table.resetRowSelection()} />
        </>
      )}
    </BulkActionBar>
  )
}
