'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { opportunityDisplayName } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import RecordCalendar from '@/features/nexacrm/components/calendar/record-calendar'

// Util Imports
import { formatCompactCurrency } from '@/features/nexacrm/utils/format'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'

// Local Imports
import OpportunityCard from '../board/opportunity-card'

const OpportunitiesCalendar = ({
  table,
  onOpenRecord
}: {
  table: Table<Opportunity>
  onOpenRecord: (id: string) => void
}) => {
  const updateOpportunity = useOpportunitiesStore(state => state.updateOpportunity)
  const { can } = useCurrentUser()

  return (
    <RecordCalendar
      table={table}
      testId='opportunities-calendar'
      canEdit={can('records:update')}
      getId={opportunity => opportunity.id}
      getDate={opportunity => opportunity.closeDate}
      onDateChange={(opportunity, closeDate) => updateOpportunity(opportunity.id, { closeDate })}
      getTitle={opportunity => opportunityDisplayName(opportunity)}
      getMeta={opportunity => (opportunity.amount ? formatCompactCurrency(opportunity.amount) : undefined)}
      isUntitled={opportunity => !opportunity.name.trim()}
      renderCard={opportunity => (
        <OpportunityCard
          opportunity={opportunity}
          mode='carried'
          onClick={() => onOpenRecord(opportunity.id)}
          className='hover:ring-primary/40 cursor-pointer transition-colors'
        />
      )}
    />
  )
}

export default OpportunitiesCalendar
