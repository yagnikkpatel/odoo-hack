'use client'

// React Imports
import { useState } from 'react'
import type { ReactNode } from 'react'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { UsersIcon } from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { toUserOption } from '@/features/nexacrm/types/apps/user-types'

// Component Imports
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import ImportDialog from '@/features/nexacrm/components/data-table/import-dialog'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import type { RecordViewType } from '@/features/nexacrm/components/data-table/record-view-bar'
import { deriveFilterOptions } from '@/features/nexacrm/components/data-table/derive-filter-options'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { downloadPeopleCsv } from '@/features/nexacrm/utils/person-utils'
import { nameMatcher } from '@/features/nexacrm/utils/csv'
import { viewTypesFor } from '@/features/nexacrm/lib/view-preference'

// Local Imports
import { REORDERABLE_COLUMN_IDS } from './columns'
import { PERSON_IMPORT_FIELDS, createPersonRowParser } from './person-import'

const PERSON_VIEW_TYPES = viewTypesFor('people')

type PeopleTableToolbarProps = {
  table: Table<Person>
  viewName: string
  count: number
  showSummary: boolean
  onShowSummaryChange: (next: boolean) => void
  viewType: RecordViewType
  onViewTypeChange: (next: RecordViewType) => void
  actions?: ReactNode
}

const PeopleTableToolbar = ({
  table,
  viewName,
  count,
  showSummary,
  onShowSummaryChange,
  viewType,
  onViewTypeChange,
  actions
}: PeopleTableToolbarProps) => {
  const users = useUsersStore(state => state.users)
  const companies = useCompaniesStore(state => state.companies)
  const addPeople = usePeopleStore(state => state.addPeople)
  const { can } = useCurrentUser()
  const [importOpen, setImportOpen] = useState(false)

  const handleExport = () =>
    downloadPeopleCsv(
      table.getFilteredRowModel().rows.map(row => row.original),
      {
        companyName: id => companies.find(company => company.id === id)?.name ?? '',
        ownerName: id => users.find(user => user.id === id)?.name ?? ''
      }
    )

  const parseRow = createPersonRowParser({
    companyId: nameMatcher(
      companies,
      company => company.name,
      company => company.id
    ),
    accountOwnerId: nameMatcher(
      users,
      user => user.name,
      user => user.id
    )
  })

  return (
    <>
      <RecordViewBar
        table={table}
        viewName={viewName}
        count={count}
        icon={UsersIcon}
        searchPlaceholder='Search people…'
        actions={actions}
        viewType={viewType}
        onViewTypeChange={onViewTypeChange}
        viewTypes={PERSON_VIEW_TYPES}
        dynamicFilterOptions={{
          accountOwnerId: users.map(toUserOption),
          createdById: users.map(toUserOption),
          companyId: companies.map(company => ({ label: company.name || 'Untitled', value: company.id })),
          jobTitle: deriveFilterOptions(table, person => person.jobTitle),
          city: deriveFilterOptions(table, person => person.city),
          country: deriveFilterOptions(table, person => person.country)
        }}
        options={
          <DataTableViewOptions
            table={table}
            reorderableColumnIds={REORDERABLE_COLUMN_IDS}
            showSummary={showSummary}
            onShowSummaryChange={onShowSummaryChange}
            onExport={handleExport}
            onImport={can('records:create') ? () => setImportOpen(true) : undefined}
          />
        }
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entity={{ singular: 'person', plural: 'people' }}
        fields={PERSON_IMPORT_FIELDS}
        parseRow={parseRow}
        onImport={addPeople}
      />
    </>
  )
}

export default PeopleTableToolbar
