'use client'

import { useState } from 'react'
import type { Table } from '@tanstack/react-table'
import { DownloadIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import BulkActionBar from '@/features/nexacrm/components/data-table/bulk-action-bar'
import { downloadContractsCsv } from '../csv'
import { useContractPermissions } from '../permissions'
import ContractDeleteDialog from '../components/contract-delete-dialog'
import type { Contract } from '../types'

export default function ContractsBulkActions({
  table,
}: {
  table: Table<Contract>
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { canDelete } = useContractPermissions()
  const selected = table.getFilteredSelectedRowModel().rows.map((row) => row.original)

  return (
    <BulkActionBar table={table}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadContractsCsv(selected)}
      >
        <DownloadIcon />
        Export selected
      </Button>
      {canDelete && (
        <>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2Icon /> Delete
          </Button>
          <ContractDeleteDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            contracts={selected}
            onDeleted={() => table.resetRowSelection()}
          />
        </>
      )}
    </BulkActionBar>
  )
}
