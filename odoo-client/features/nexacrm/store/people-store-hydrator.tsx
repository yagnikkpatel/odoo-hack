'use client'

// React Imports
import { useEffect } from 'react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'

// Store Imports
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'

const PeopleStoreHydrator = ({ data }: { data: Person[] }) => {
  useEffect(() => {
    usePeopleStore.getState().initialize(data)
  }, [data])

  return null
}

export default PeopleStoreHydrator
