'use client'

// React Imports
import { createContext, useContext, useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'

// Type Imports
import type { User } from '@/features/nexacrm/types/apps/user-types'
import type { Permission } from '@/features/nexacrm/types/rbac-types'

// Store Imports
import { useCurrentActorStore } from '@/features/nexacrm/store/use-current-actor-store'
import { DATA_API_CONNECTED } from '@/features/hr/data-availability'
import { ROLE_PERMISSIONS } from '@/features/nexacrm/types/rbac-types'

type CurrentUserContextValue = {
  user: User
  can: (permission: Permission) => boolean
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

type CurrentUserProviderProps = {
  user: User
  children: ReactNode
}

export const CurrentUserProvider = ({ user, children }: CurrentUserProviderProps) => {
  useEffect(() => {
    useCurrentActorStore.getState().setActorId(user.id)
  }, [user.id])

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      user,
      // A local record edit must not look like a successful backend save.
      // Backend endpoints must enforce their own resource-specific authorization.
      can: permission =>
        permission === 'records:read' || (DATA_API_CONNECTED && ROLE_PERMISSIONS[user.role].includes(permission))
    }),
    [user]
  )

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>
}

export const useCurrentUser = (): CurrentUserContextValue => {
  const context = useContext(CurrentUserContext)

  if (!context) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider')
  }

  return context
}
