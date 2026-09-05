// Type Imports
import { OPPORTUNITY_STAGES, OPPORTUNITY_STAGE_LABELS, OPPORTUNITY_STAGE_TONES } from '@/features/nexacrm/types/apps/opportunity-types'

// Store Imports
import { createStagesStore } from '@/features/nexacrm/store/create-stages-store'

export const useOpportunityStagesStore = createStagesStore({
  stages: OPPORTUNITY_STAGES,
  labels: OPPORTUNITY_STAGE_LABELS,
  tones: OPPORTUNITY_STAGE_TONES
})
