'use client'

// Store Imports
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

export const usePersonAvatar = (email?: string): string | undefined => {
  const users = useUsersStore(state => state.users)
  const people = usePeopleStore(state => state.people)

  if (!email) return undefined

  const address = email.trim().toLowerCase()

  const user = users.find(candidate => candidate.email.toLowerCase() === address)

  if (user?.avatar) return user.avatar

  return people.find(candidate => candidate.email.toLowerCase() === address)?.avatar
}
