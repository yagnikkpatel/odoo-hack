'use client'

// React Imports
import { useEffect } from 'react'

// Type Imports
import type { Company } from '@/features/nexacrm/types/apps/company-types'

// Store Imports
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'

const CompaniesStoreHydrator = ({ data }: { data: Company[] }) => {
  useEffect(() => {
    useCompaniesStore.getState().initialize(data)
  }, [data])

  return null
}

export default CompaniesStoreHydrator
