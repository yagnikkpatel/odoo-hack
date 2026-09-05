'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// Third-party Imports
import { LoaderCircleIcon } from 'lucide-react'

// Type Imports
import { opportunityDisplayName } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import SidePanel from '@/features/nexacrm/components/layout/side-panel'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'
import OpportunityFields from '@/features/nexacrm/components/record/opportunity-fields'
import type { SubRecordTarget } from '@/features/nexacrm/components/record/sub-record-sheet'
import SubRecordSheet from '@/features/nexacrm/components/record/sub-record-sheet'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useRecordBreadcrumb } from '@/features/nexacrm/store/use-breadcrumb-store'
import { useOpportunitiesStore, useOpportunity } from '@/features/nexacrm/store/use-opportunities-store'
import { usePerson } from '@/features/nexacrm/store/use-people-store'

// Local Imports
import OpportunityDetailHeader from './detail-header'
import OpportunityDetailTabs from './detail-tabs'

const OpportunityDetailView = ({
  opportunityId,
  initialSection
}: {
  opportunityId: string
  initialSection?: string
}) => {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [subRecord, setSubRecord] = useState<SubRecordTarget | null>(null)

  const opportunity = useOpportunity(opportunityId)
  const hasHydrated = useOpportunitiesStore(state => state.hasHydrated)
  const deleteOpportunity = useOpportunitiesStore(state => state.deleteOpportunity)
  const { can } = useCurrentUser()

  const pointOfContact = usePerson(opportunity?.pointOfContactId)

  useRecordBreadcrumb(opportunity ? opportunityDisplayName(opportunity) : undefined)

  if (!opportunity) {
    if (hasHydrated && !isDeleting) {
      return <RecordNotFound label='Opportunity' backHref='/opportunities' backLabel='Opportunities' />
    }

    return (
      <div className='flex flex-1 items-center justify-center py-16'>
        <LoaderCircleIcon className='text-muted-foreground size-5 animate-spin' />
      </div>
    )
  }

  const handleDelete = () => {
    setIsDeleting(true)
    deleteOpportunity(opportunity.id)
    router.push('/opportunities')
  }

  const canEdit = can('records:update')

  return (
    <div className='flex min-h-0 flex-col'>
      <OpportunityDetailHeader
        opportunity={opportunity}
        onDelete={handleDelete}
        onOpenPanel={() => setRailOpen(true)}
      />

      <div className='grid xl:min-h-0 xl:flex-1 xl:grid-cols-[20rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]'>
        <SidePanel
          side='left'
          breakpoint='xl'
          open={railOpen}
          onOpenChange={setRailOpen}
          title={`${opportunityDisplayName(opportunity)} details`}
          description='Amount, stage and linked records.'
          className='xl:min-h-0 xl:border-r'
        >
          <ScrollArea className='xl:h-full'>
            <div className='xl:py-4 xl:pr-4'>
              <OpportunityFields opportunity={opportunity} canEdit={canEdit} />
            </div>
          </ScrollArea>
        </SidePanel>

        <OpportunityDetailTabs
          opportunity={opportunity}
          initialSection={initialSection}
          onOpenSubRecord={setSubRecord}
        />
      </div>

      <SubRecordSheet
        target={subRecord}
        entityType='opportunity'
        entityId={opportunity.id}
        defaultEmailTo={pointOfContact?.email}
        onClose={() => setSubRecord(null)}
      />
    </div>
  )
}

export default OpportunityDetailView
