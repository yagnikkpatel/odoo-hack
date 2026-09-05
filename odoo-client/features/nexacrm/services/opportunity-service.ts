import 'server-only'

import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'

// Business-data APIs are not connected yet. Never manufacture records as a fallback.
export const getOpportunities = async (): Promise<Opportunity[]> => []

export const getOpportunityById: (id: string) => Promise<Opportunity | undefined> = async () => undefined
