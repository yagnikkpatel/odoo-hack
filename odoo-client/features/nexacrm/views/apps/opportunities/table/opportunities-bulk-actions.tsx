'use client'

// React Imports
import { useState } from 'react'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { DownloadIcon, Trash2Icon } from 'lucide-react'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import BulkActionBar from '@/features/nexacrm/components/data-table/bulk-action-bar'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'

// Local Imports
import { useOpportunityExport } from './use-opportunity-export'

const OpportunitiesBulkActions = ({ table }: { table: Table<Opportunity> }) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const deleteOpportunities = useOpportunitiesStore(state => state.deleteOpportunities)
  const { can } = useCurrentUser()
  const exportOpportunities = useOpportunityExport()

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const count = selectedRows.length

  const handleDelete = () => {
    deleteOpportunities(selectedRows.map(row => row.original.id))
    table.resetRowSelection()
  }

  const handleExport = () => exportOpportunities(selectedRows.map(row => row.original))

  return (
    <BulkActionBar table={table}>
      <Button variant='outline' size='sm' onClick={handleExport}>
        <DownloadIcon /> Export
      </Button>

      {!can('records:delete') ? null : (
        <>
          <Button variant='destructive' size='sm' onClick={() => setConfirmOpen(true)}>
            <Trash2Icon /> Delete
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title={`Delete ${count} ${count === 1 ? 'opportunity' : 'opportunities'}?`}
            description='This will permanently remove the selected opportunities. This action cannot be undone.'
            confirmLabel='Delete'
            onConfirm={handleDelete}
          />
        </>
      )}
    </BulkActionBar>
  )
}

export default OpportunitiesBulkActions
