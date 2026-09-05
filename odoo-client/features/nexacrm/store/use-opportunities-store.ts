// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { ActivityChange } from '@/features/nexacrm/types/apps/activity-types'
import type { Opportunity, OpportunityInput } from '@/features/nexacrm/types/apps/opportunity-types'
import { OPPORTUNITY_FIELD_LABELS, opportunityDisplayName } from '@/features/nexacrm/types/apps/opportunity-types'

// Store Imports
import { useActivitiesStore } from '@/features/nexacrm/store/use-activities-store'
import { getActorId } from '@/features/nexacrm/store/use-current-actor-store'

const buildOpportunity = (input: OpportunityInput): Opportunity => {
  const now = new Date().toISOString()

  return {
    createdById: getActorId(),
    ...input,
    id: `opp_${crypto.randomUUID().slice(0, 8)}`,
    stageHistory: [{ stage: input.stage, enteredAt: now }],
    createdAt: now,
    updatedAt: now
  }
}

const logFieldChanges = (before: Opportunity, input: Partial<Opportunity>) => {
  const changes: ActivityChange[] = []

  for (const key of Object.keys(input) as (keyof Opportunity)[]) {
    const label = OPPORTUNITY_FIELD_LABELS[key]

    if (!label || before[key] === input[key]) continue

    changes.push({ label, value: input[key] ? String(input[key]) : undefined })
  }

  if (changes.length === 0) return

  const subject = 'name' in input && input.name ? input.name : opportunityDisplayName(before)

  useActivitiesStore.getState().addActivity({
    entityType: 'opportunity',
    entityId: before.id,
    type: 'status',
    actorId: getActorId(),
    verb: `updated ${changes.length} ${changes.length === 1 ? 'field' : 'fields'} on`,
    subject,
    changes
  })
}

type OpportunitiesData = {
  opportunities: Opportunity[]
  hasHydrated: boolean
}

type OpportunitiesActions = {
  initialize: (opportunities: Opportunity[]) => void
  addOpportunity: (input: OpportunityInput) => string
  updateOpportunity: (id: string, input: Partial<Omit<Opportunity, 'id' | 'createdAt'>>) => void

  /** The board's drag handler - the one write that must not be a general update. */
  setOpportunityStage: (id: string, stage: string) => void
  deleteOpportunity: (id: string) => void
  deleteOpportunities: (ids: string[]) => void
}

export type OpportunitiesStore = OpportunitiesData & OpportunitiesActions

export const useOpportunitiesStore = create<OpportunitiesStore>()((set, get) => ({
  opportunities: [],
  hasHydrated: false,

  initialize: opportunities => set({ opportunities, hasHydrated: true }),

  addOpportunity: input => {
    const opportunity = buildOpportunity(input)

    set(state => ({ opportunities: [opportunity, ...state.opportunities] }))

    return opportunity.id
  },

  updateOpportunity: (id, input) => {
    const before = get().opportunities.find(opportunity => opportunity.id === id)
    const now = new Date().toISOString()

    const stageMoved = before && input.stage != null && input.stage !== before.stage
    const outcomeMoved = before && input.outcome != null && input.outcome !== before.outcome

    const derived: Partial<Opportunity> = {}

    if (stageMoved) derived.stageHistory = [...before.stageHistory, { stage: input.stage!, enteredAt: now }]

    if (outcomeMoved && !('closedAt' in input)) {
      derived.closedAt = input.outcome === 'open' ? undefined : now
    }

    set(state => ({
      opportunities: state.opportunities.map(opportunity =>
        opportunity.id === id
          ? { ...opportunity, ...input, ...derived, updatedById: getActorId(), updatedAt: now }
          : opportunity
      )
    }))

    if (before) logFieldChanges(before, input)
  },

  setOpportunityStage: (id, stage) => get().updateOpportunity(id, { stage }),

  deleteOpportunity: id =>
    set(state => ({ opportunities: state.opportunities.filter(opportunity => opportunity.id !== id) })),

  deleteOpportunities: ids =>
    set(state => ({ opportunities: state.opportunities.filter(opportunity => !ids.includes(opportunity.id)) }))
}))

/** One opportunity by id - the panel, the sheet and the record page all resolve their subject here. */
export const useOpportunity = (id?: string): Opportunity | undefined =>
  useOpportunitiesStore(state => (id ? state.opportunities.find(opportunity => opportunity.id === id) : undefined))

export const useCompanyOpportunities = (companyId?: string): Opportunity[] => {
  const opportunities = useOpportunitiesStore(state => state.opportunities)

  return useMemo(() => {
    if (!companyId) return []

    return opportunities.filter(opportunity => opportunity.companyId === companyId)
  }, [opportunities, companyId])
}

export const usePersonOpportunities = (personId?: string): Opportunity[] => {
  const opportunities = useOpportunitiesStore(state => state.opportunities)

  return useMemo(() => {
    if (!personId) return []

    return opportunities.filter(opportunity => opportunity.pointOfContactId === personId)
  }, [opportunities, personId])
}

export const useOpportunityNavigation = (id: string) => {
  const opportunities = useOpportunitiesStore(state => state.opportunities)

  return useMemo(() => {
    const index = opportunities.findIndex(opportunity => opportunity.id === id)

    return {
      index,
      total: opportunities.length,
      previousId: index > 0 ? opportunities[index - 1].id : undefined,
      nextId: index >= 0 && index < opportunities.length - 1 ? opportunities[index + 1].id : undefined
    }
  }, [opportunities, id])
}
