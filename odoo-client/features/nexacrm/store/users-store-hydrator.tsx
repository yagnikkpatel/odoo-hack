'use client'

// React Imports
import { useEffect } from 'react'

// Type Imports
import type { User } from '@/features/nexacrm/types/apps/user-types'

// Store Imports
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

const UsersStoreHydrator = ({ data }: { data: User[] }) => {
  useEffect(() => {
    useUsersStore.getState().initialize(data)
  }, [data])

  return null
}

export default UsersStoreHydrator
