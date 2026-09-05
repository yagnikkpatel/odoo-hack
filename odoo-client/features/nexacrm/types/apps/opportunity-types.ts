// Util Imports
import type { BadgeTone } from '@/features/nexacrm/lib/badge-tone'

export const OPPORTUNITY_STAGES = ['new', 'screening', 'meeting', 'proposal', 'customer'] as const

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number] | (string & {})

export const OPPORTUNITY_OUTCOMES = ['open', 'won', 'lost'] as const

export type OpportunityOutcome = (typeof OPPORTUNITY_OUTCOMES)[number]

export const OPPORTUNITY_OUTCOME_LABELS: Record<OpportunityOutcome, string> = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost'
}

export const OPPORTUNITY_OUTCOME_TONES: Record<OpportunityOutcome, BadgeTone> = {
  open: 'info',
  won: 'success',
  lost: 'danger'
}

export const OPPORTUNITY_OUTCOME_OPTIONS = OPPORTUNITY_OUTCOMES.map(outcome => ({
  label: OPPORTUNITY_OUTCOME_LABELS[outcome],
  value: outcome
}))

export const OPPORTUNITY_SOURCES = ['inbound', 'outbound', 'referral', 'event', 'partner'] as const

export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number]

export const OPPORTUNITY_SOURCE_LABELS: Record<OpportunitySource, string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
  referral: 'Referral',
  event: 'Event',
  partner: 'Partner'
}

export const OPPORTUNITY_SOURCE_OPTIONS = OPPORTUNITY_SOURCES.map(source => ({
  label: OPPORTUNITY_SOURCE_LABELS[source],
  value: source
}))

export type OpportunityStageEntry = {
  stage: OpportunityStage

  /** ISO timestamp the opportunity ENTERED this stage. */
  enteredAt: string
}

export const OPPORTUNITY_STAGE_LABELS: Record<string, string> = {
  new: 'New',
  screening: 'Screening',
  meeting: 'Meeting',
  proposal: 'Proposal',
  customer: 'Customer'
}

export const OPPORTUNITY_STAGE_TONES: Record<string, BadgeTone> = {
  new: 'danger',
  screening: 'purple',
  meeting: 'info',
  proposal: 'success',
  customer: 'warning'
}

const humanize = (stage: string) => stage.replace(/[_-]+/g, ' ').replace(/^./, character => character.toUpperCase())

/** Display label for any stage - seeded or custom. */
export const opportunityStageLabel = (stage: OpportunityStage): string =>
  OPPORTUNITY_STAGE_LABELS[stage] ?? humanize(stage)

/** Badge tone for any stage; a custom one is neutral until someone assigns it a meaning. */
export const opportunityStageTone = (stage: OpportunityStage): BadgeTone => OPPORTUNITY_STAGE_TONES[stage] ?? 'neutral'

export const OPPORTUNITY_STAGE_OPTIONS = OPPORTUNITY_STAGES.map(stage => ({
  label: OPPORTUNITY_STAGE_LABELS[stage],
  value: stage
}))

export const isOpenOpportunity = (opportunity: Pick<Opportunity, 'outcome'>): boolean => opportunity.outcome === 'open'

/** Closed and landed. `won` is the outcome, not the `customer` stage - a deal can sit there unclosed. */
export const isWonOpportunity = (opportunity: Pick<Opportunity, 'outcome'>): boolean => opportunity.outcome === 'won'

export const weightedAmount = (opportunity: Pick<Opportunity, 'amount' | 'probability'>): number =>
  (opportunity.amount * opportunity.probability) / 100

export const hasEnteredStage = (opportunity: Pick<Opportunity, 'stageHistory'>, stage: OpportunityStage): boolean =>
  opportunity.stageHistory.some(entry => entry.stage === stage)

export const isOverdueOpportunity = (opportunity: Pick<Opportunity, 'outcome' | 'closeDate'>): boolean =>
  isOpenOpportunity(opportunity) && !!opportunity.closeDate && opportunity.closeDate < new Date().toISOString()

export type Opportunity = {
  id: string
  name: string

  stage: OpportunityStage

  outcome: OpportunityOutcome

  /** OURS - where it came from. Non-optional; the Leads dashboard groups every chart by this. */
  source: OpportunitySource

  probability: number

  closedAt?: string

  stageHistory: OpportunityStageEntry[]

  /** Value in whole currency units. See the note at the top about single-currency amounts. */
  amount: number

  companyId?: string

  pointOfContactId?: string

  ownerId?: string

  /** ISO date the opportunity is expected to close. */
  closeDate?: string

  createdById?: string
  updatedById?: string
  createdAt: string
  updatedAt: string
}

export type OpportunityInput = Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'stageHistory'>

export const buildBlankOpportunityInput = (): OpportunityInput => ({
  name: '',
  stage: 'new',
  outcome: 'open',
  source: 'inbound',
  probability: 10,
  amount: 0
})

/** Display name for an opportunity whose name has not been filled in yet. */
export const opportunityDisplayName = (opportunity: Pick<Opportunity, 'name'>): string =>
  opportunity.name.trim() || 'Untitled'

export const OPPORTUNITY_FIELD_LABELS: Partial<Record<keyof Opportunity, string>> = {
  name: 'Name',
  stage: 'Stage',
  outcome: 'Outcome',
  source: 'Source',
  probability: 'Probability',
  amount: 'Amount',
  closeDate: 'Close date',
  companyId: 'Company',
  pointOfContactId: 'Point of Contact',
  ownerId: 'Owner'
}
