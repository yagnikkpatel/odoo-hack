// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import {
  OPPORTUNITY_OUTCOME_LABELS,
  OPPORTUNITY_SOURCE_LABELS,
  opportunityDisplayName,
  opportunityStageLabel
} from '@/features/nexacrm/types/apps/opportunity-types'

// Util Imports
import { downloadCsv } from '@/features/nexacrm/utils/csv'
import { formatDate } from '@/features/nexacrm/utils/format'

export const downloadOpportunitiesCsv = (
  opportunities: Opportunity[],
  resolve: {
    userName: (userId?: string) => string
    companyName: (companyId?: string) => string
    personName: (personId?: string) => string
  },
  filename = 'opportunities.csv'
): void =>
  downloadCsv(
    filename,
    opportunities.map(opportunity => ({
      Name: opportunityDisplayName(opportunity),
      Amount: opportunity.amount,
      'Created by': resolve.userName(opportunity.createdById),
      'Close date': opportunity.closeDate ? formatDate(opportunity.closeDate) : '',
      Company: resolve.companyName(opportunity.companyId),
      'Point of Contact': resolve.personName(opportunity.pointOfContactId),
      Stage: opportunityStageLabel(opportunity.stage),
      Owner: resolve.userName(opportunity.ownerId),
      Outcome: OPPORTUNITY_OUTCOME_LABELS[opportunity.outcome],
      Source: OPPORTUNITY_SOURCE_LABELS[opportunity.source],
      Probability: `${opportunity.probability}%`,
      'Closed date': opportunity.closedAt ? formatDate(opportunity.closedAt) : ''
    }))
  )
