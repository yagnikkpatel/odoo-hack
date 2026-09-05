'use client'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import {
  isOpenOpportunity,
  opportunityDisplayName,
  opportunityStageLabel,
  opportunityStageTone
} from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import { RelatedRecordRow, RelatedRecordSection } from '@/features/nexacrm/components/record/related-record-section'
import StageBadge from '@/features/nexacrm/components/kanban/stage-badge'
import OpportunitySummary from '@/features/nexacrm/components/record/summaries/opportunity-summary'

// Store Imports
import { useOpportunityStagesStore } from '@/features/nexacrm/store/use-opportunity-stages-store'

// Util Imports
import { formatCompactCurrency } from '@/features/nexacrm/utils/format'

type OpportunityLinkable = {
  available: Opportunity[]
  onLink: (opportunityId: string) => void
  onUnlink: (opportunityId: string) => void
}

type RelatedOpportunitiesProps = {
  opportunities: Opportunity[]
  emptyLabel?: string
  linkable?: OpportunityLinkable
}

const RelatedOpportunities = ({
  opportunities,
  emptyLabel = 'No opportunities yet.',
  linkable
}: RelatedOpportunitiesProps) => {
  const openPipeline = opportunities.filter(isOpenOpportunity).reduce((sum, opportunity) => sum + opportunity.amount, 0)

  return (
    <RelatedRecordSection
      title='Opportunities'
      count={opportunities.length}
      meta={openPipeline > 0 ? `${formatCompactCurrency(openPipeline)} open` : undefined}
      emptyLabel={emptyLabel}
      linkable={
        linkable
          ? {
              available: linkable.available.map(opportunity => ({
                id: opportunity.id,
                label: opportunityDisplayName(opportunity),
                meta: formatCompactCurrency(opportunity.amount)
              })),

              linkedIds: opportunities.map(opportunity => opportunity.id),
              onToggle: (id, isLinked) => (isLinked ? linkable.onUnlink(id) : linkable.onLink(id)),
              addLabel: 'Link an opportunity',
              searchPlaceholder: 'Search opportunities…',
              emptyPickerLabel: 'No opportunities yet.'
            }
          : undefined
      }
    >
      {opportunities.map(opportunity => (
        <RelatedRecordRow
          key={opportunity.id}
          href={`/opportunities/${opportunity.id}`}
          label={opportunityDisplayName(opportunity)}
          meta={
            <>
              <span className='text-muted-foreground text-xs tabular-nums'>
                {formatCompactCurrency(opportunity.amount)}
              </span>
              <StageBadge
                stagesStore={useOpportunityStagesStore}
                stage={opportunity.stage}
                fallbackLabel={opportunityStageLabel(opportunity.stage)}
                fallbackTone={opportunityStageTone(opportunity.stage)}
              />
            </>
          }
          onUnlink={linkable ? () => linkable.onUnlink(opportunity.id) : undefined}
          unlinkLabel={`Unlink ${opportunityDisplayName(opportunity)}`}
        >
          <OpportunitySummary opportunity={opportunity} />
        </RelatedRecordRow>
      ))}
    </RelatedRecordSection>
  )
}

export default RelatedOpportunities
