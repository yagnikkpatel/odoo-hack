'use client'

// React Imports
import { useState } from 'react'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { DownloadIcon, Trash2Icon } from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import BulkActionBar from '@/features/nexacrm/components/data-table/bulk-action-bar'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { downloadPeopleCsv } from '@/features/nexacrm/utils/person-utils'

const PeopleBulkActions = ({ table }: { table: Table<Person> }) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const deletePeople = usePeopleStore(state => state.deletePeople)
  const companies = useCompaniesStore(state => state.companies)
  const users = useUsersStore(state => state.users)
  const { can } = useCurrentUser()

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const count = selectedRows.length

  const handleDelete = () => {
    deletePeople(selectedRows.map(row => row.original.id))
    table.resetRowSelection()
  }

  const handleExport = () =>
    downloadPeopleCsv(
      selectedRows.map(row => row.original),
      {
        companyName: id => companies.find(company => company.id === id)?.name ?? '',
        ownerName: id => users.find(user => user.id === id)?.name ?? ''
      }
    )

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
            title={`Delete ${count} ${count === 1 ? 'person' : 'people'}?`}
            description='This will permanently remove the selected people. This action cannot be undone.'
            confirmLabel='Delete'
            onConfirm={handleDelete}
          />
        </>
      )}
    </BulkActionBar>
  )
}

export default PeopleBulkActions
