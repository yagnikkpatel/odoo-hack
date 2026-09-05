'use client'

// React Imports
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

// Type Imports
import type { User } from '@/features/nexacrm/types/apps/user-types'
import type { Permission } from '@/features/nexacrm/types/rbac-types'

// Store Imports
import { useCurrentActorStore } from '@/features/nexacrm/store/use-current-actor-store'
import { useRolesStore } from '@/features/nexacrm/store/use-roles-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

// Utils Imports
import { can as canForUser } from '@/features/nexacrm/lib/rbac'

type CurrentUserContextValue = {
  user: User
  can: (permission: Permission) => boolean
  setCurrentUser: (user: User) => void
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null)

type CurrentUserProviderProps = {
  user: User
  children: ReactNode
}

export const CurrentUserProvider = ({ user: initialUser, children }: CurrentUserProviderProps) => {
  const [seed, setSeed] = useState(initialUser)

  const permissions = useRolesStore(state => state.permissions)

  const stored = useUsersStore(state => state.users.find(candidate => candidate.id === seed.id))
  const user = stored ?? seed

  useEffect(() => {
    useCurrentActorStore.getState().setActorId(user.id)
  }, [user.id])

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      user,
      can: permission => canForUser(permissions, user, permission),
      setCurrentUser: setSeed
    }),
    [permissions, user]
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
