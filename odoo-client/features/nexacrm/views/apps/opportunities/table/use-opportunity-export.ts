'use client'

// React Imports
import { useCallback } from 'react'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'

// Store Imports
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { downloadOpportunitiesCsv } from '@/features/nexacrm/utils/opportunity-utils'

export const useOpportunityExport = () => {
  const users = useUsersStore(state => state.users)
  const companies = useCompaniesStore(state => state.companies)
  const people = usePeopleStore(state => state.people)

  return useCallback(
    (opportunities: Opportunity[], filename?: string) =>
      downloadOpportunitiesCsv(
        opportunities,
        {
          userName: id => users.find(user => user.id === id)?.name ?? '',

          companyName: id => companies.find(company => company.id === id)?.name ?? '',
          personName: id => {
            const person = people.find(item => item.id === id)

            return person ? personDisplayName(person) : ''
          }
        },
        filename
      ),
    [users, companies, people]
  )
}
