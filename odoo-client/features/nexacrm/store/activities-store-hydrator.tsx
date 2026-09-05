'use client'

// React Imports
import { useEffect } from 'react'

// Type Imports
import type { Activity } from '@/features/nexacrm/types/apps/activity-types'

// Store Imports
import { useActivitiesStore } from '@/features/nexacrm/store/use-activities-store'

const ActivitiesStoreHydrator = ({ data }: { data: Activity[] }) => {
  useEffect(() => {
    useActivitiesStore.getState().initialize(data)
  }, [data])

  return null
}

export default ActivitiesStoreHydrator
