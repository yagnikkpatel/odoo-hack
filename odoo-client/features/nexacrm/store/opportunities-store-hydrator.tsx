'use client'

// React Imports
import { useEffect } from 'react'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'

// Store Imports
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'

const OpportunitiesStoreHydrator = ({ data }: { data: Opportunity[] }) => {
  useEffect(() => {
    useOpportunitiesStore.getState().initialize(data)
  }, [data])

  return null
}

export default OpportunitiesStoreHydrator
