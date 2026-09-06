'use client'

import { payrollAccess, type Actor } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useCurrentActorStore } from '@/features/nexacrm/store/use-current-actor-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

export function payrollPermissions(role = 'employee') {
  return payrollAccess({ role })
}

function availablePermissions(actor: Actor) {
  return payrollAccess(actor)
}

export function getPayrollPermissions() {
  const actor = useCurrentActorStore.getState().actorId
  return availablePermissions(useUsersStore.getState().users.find(user => user.id === actor) || { role: 'employee' })
}

export function usePayrollPermissions() {
  return availablePermissions(useCurrentUser().user)
}
