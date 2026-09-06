'use client'

import { payrollAccess, type Actor } from '@/features/auth/permissions'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useCurrentActorStore } from '@/features/nexacrm/store/use-current-actor-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'
import { DATA_API_CONNECTED } from '@/features/hr/data-availability'

export function payrollPermissions(role = 'employee') {
  return payrollAccess({ role })
}

function availablePermissions(actor: Actor) {
  const permissions = payrollAccess(actor)
  // Local payroll writes remain unavailable until their data API is connected.
  return {
    ...permissions,
    canProcess: DATA_API_CONNECTED && permissions.canProcess,
    canConfigure: DATA_API_CONNECTED && permissions.canConfigure,
    canDelete: DATA_API_CONNECTED && permissions.canDelete,
    canSend: DATA_API_CONNECTED && permissions.canSend,
    canCreatePayrun: DATA_API_CONNECTED && permissions.canCreatePayrun,
    canDeletePayrun: DATA_API_CONNECTED && permissions.canDeletePayrun,
    canDeletePayslip: DATA_API_CONNECTED && permissions.canDeletePayslip,
    canConfigureRules: DATA_API_CONNECTED && permissions.canConfigureRules,
    canConfigureStructures: DATA_API_CONNECTED && permissions.canConfigureStructures,
    canCreateRules: DATA_API_CONNECTED && permissions.canCreateRules,
    canCreateStructures: DATA_API_CONNECTED && permissions.canCreateStructures,
    canDeleteRules: DATA_API_CONNECTED && permissions.canDeleteRules,
    canDeleteStructures: DATA_API_CONNECTED && permissions.canDeleteStructures,
  }
}

export function getPayrollPermissions() {
  const actor = useCurrentActorStore.getState().actorId
  return availablePermissions(useUsersStore.getState().users.find(user => user.id === actor) || { role: 'employee' })
}

export function usePayrollPermissions() {
  return availablePermissions(useCurrentUser().user)
}
