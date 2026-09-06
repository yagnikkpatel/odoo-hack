'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { toUserOption } from '@/features/nexacrm/types/apps/user-types'

// Component Imports
import TableFilterBar from '@/features/nexacrm/components/data-table/table-filter-bar'
import { deriveFilterOptions } from '@/features/nexacrm/components/data-table/derive-filter-options'

// Store Imports
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

const PeopleFilters = ({ table }: { table: Table<Person> }) => {
  const users = useUsersStore(state => state.users)
  const companies = useCompaniesStore(state => state.companies)

  return (
    <TableFilterBar
      table={table}
      dynamicFilterOptions={{
        accountOwnerId: users.map(toUserOption),
        createdById: users.map(toUserOption),
        companyId: companies.map(company => ({ label: company.name || 'Untitled', value: company.id })),
        jobTitle: deriveFilterOptions(table, person => person.jobTitle),
        city: deriveFilterOptions(table, person => person.city),
        country: deriveFilterOptions(table, person => person.country)
      }}
    />
  )
}

export default PeopleFilters
