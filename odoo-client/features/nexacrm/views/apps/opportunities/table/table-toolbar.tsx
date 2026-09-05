'use client'

// React Imports
import type { ReactNode } from 'react'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { TargetIcon } from 'lucide-react'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'
import { toUserOption } from '@/features/nexacrm/types/apps/user-types'

// Component Imports
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import type { RecordViewType } from '@/features/nexacrm/components/data-table/record-view-bar'

// Store Imports
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'
import { useStageOptions } from '@/features/nexacrm/store/create-stages-store'
import { useOpportunityStagesStore } from '@/features/nexacrm/store/use-opportunity-stages-store'

// Util Imports
import { viewTypesFor } from '@/features/nexacrm/lib/view-preference'

// Local Imports
import { REORDERABLE_COLUMN_IDS } from './columns'
import { useOpportunityExport } from './use-opportunity-export'

type OpportunitiesTableToolbarProps = {
  table: Table<Opportunity>
  viewName: string
  count: number
  showSummary: boolean
  onShowSummaryChange: (next: boolean) => void
  viewType: RecordViewType
  onViewTypeChange: (next: RecordViewType) => void
  actions?: ReactNode
}

const OPPORTUNITY_VIEW_TYPES = viewTypesFor('opportunities')

const OpportunitiesTableToolbar = ({
  table,
  viewName,
  count,
  showSummary,
  onShowSummaryChange,
  viewType,
  onViewTypeChange,
  actions
}: OpportunitiesTableToolbarProps) => {
  const users = useUsersStore(state => state.users)
  const companies = useCompaniesStore(state => state.companies)
  const people = usePeopleStore(state => state.people)
  const exportOpportunities = useOpportunityExport()
  const stageOptions = useStageOptions(useOpportunityStagesStore)

  const handleExport = () => exportOpportunities(table.getFilteredRowModel().rows.map(row => row.original))

  const userOptions = users.map(toUserOption)

  return (
    <RecordViewBar
      table={table}
      viewName={viewName}
      count={count}
      icon={TargetIcon}
      searchPlaceholder='Search opportunities…'
      actions={actions}
      viewType={viewType}
      onViewTypeChange={onViewTypeChange}
      viewTypes={OPPORTUNITY_VIEW_TYPES}
      dynamicFilterOptions={{
        stage: stageOptions,
        createdById: userOptions,
        ownerId: userOptions,
        companyId: companies.map(company => ({ label: company.name.trim() || 'Untitled', value: company.id })),
        pointOfContactId: people.map(person => ({ label: personDisplayName(person), value: person.id }))
      }}
      options={
        <DataTableViewOptions
          table={table}
          reorderableColumnIds={REORDERABLE_COLUMN_IDS}
          showSummary={showSummary}
          onShowSummaryChange={onShowSummaryChange}
          onExport={handleExport}
        />
      }
    />
  )
}

export default OpportunitiesTableToolbar
