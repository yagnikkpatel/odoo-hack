'use client'

// Third-party Imports
import { BuildingIcon, CalendarIcon, CircleDotIcon, DollarSignIcon, UserIcon, UserRoundIcon } from 'lucide-react'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { opportunityStageLabel } from '@/features/nexacrm/types/apps/opportunity-types'
import { formatPersonName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import RecordField from '@/features/nexacrm/components/record/record-field'
import UserChip from '@/features/nexacrm/components/record/user-chip'

// Store Imports
import { useCompany } from '@/features/nexacrm/store/use-companies-store'
import { usePerson } from '@/features/nexacrm/store/use-people-store'

// Util Imports
import { formatCompactCurrency, formatDate } from '@/features/nexacrm/utils/format'

const OpportunitySummary = ({ opportunity }: { opportunity: Opportunity }) => {
  const company = useCompany(opportunity.companyId)
  const pointOfContact = usePerson(opportunity.pointOfContactId)

  return (
    <>
      <RecordField type='static' label='Amount' icon={DollarSignIcon}>
        <span className='text-sm tabular-nums'>{formatCompactCurrency(opportunity.amount)}</span>
      </RecordField>

      <RecordField type='static' label='Stage' icon={CircleDotIcon}>
        <span className='text-sm'>{opportunityStageLabel(opportunity.stage)}</span>
      </RecordField>

      {opportunity.closeDate ? (
        <RecordField type='static' label='Close date' icon={CalendarIcon}>
          <span className='text-sm'>{formatDate(opportunity.closeDate)}</span>
        </RecordField>
      ) : null}

      {company ? (
        <RecordField type='static' label='Company' icon={BuildingIcon}>
          <span className='truncate text-sm'>{company.name || 'Untitled'}</span>
        </RecordField>
      ) : null}

      {pointOfContact ? (
        <RecordField type='static' label='Point of Contact' icon={UserRoundIcon}>
          <span className='truncate text-sm'>{formatPersonName(pointOfContact)}</span>
        </RecordField>
      ) : null}

      <RecordField type='static' label='Owner' icon={UserIcon}>
        <UserChip userId={opportunity.ownerId} />
      </RecordField>
    </>
  )
}

export default OpportunitySummary
