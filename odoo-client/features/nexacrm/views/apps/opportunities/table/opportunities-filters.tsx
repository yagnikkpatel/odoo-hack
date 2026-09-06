'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'
import { toUserOption } from '@/features/nexacrm/types/apps/user-types'

// Component Imports
import TableFilterBar from '@/features/nexacrm/components/data-table/table-filter-bar'

// Store Imports
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'
import { useStageOptions } from '@/features/nexacrm/store/create-stages-store'
import { useOpportunityStagesStore } from '@/features/nexacrm/store/use-opportunity-stages-store'

const OpportunitiesFilters = ({ table }: { table: Table<Opportunity> }) => {
  const users = useUsersStore(state => state.users)
  const companies = useCompaniesStore(state => state.companies)
  const people = usePeopleStore(state => state.people)
  const stageOptions = useStageOptions(useOpportunityStagesStore)

  const userOptions = users.map(toUserOption)

  return (
    <TableFilterBar
      table={table}
      dynamicFilterOptions={{
        stage: stageOptions,
        createdById: userOptions,
        ownerId: userOptions,
        companyId: companies.map(company => ({ label: company.name.trim() || 'Untitled', value: company.id })),
        pointOfContactId: people.map(person => ({ label: personDisplayName(person), value: person.id }))
      }}
    />
  )
}

export default OpportunitiesFilters
