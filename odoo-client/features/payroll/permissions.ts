import { useCurrentActorStore } from '@/features/nexacrm/store/use-current-actor-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'
import { DATA_API_CONNECTED } from '@/features/hr/data-availability'
export function payrollPermissions(role?: string) {
  const resolved = role || 'employee'
  const canRead = ['admin', 'hr_payroll_manager', 'hr_payroll_user'].includes(resolved)
  const canConfigure = ['admin', 'hr_payroll_manager'].includes(resolved)
  return { role: resolved, canRead, canProcess: canRead, canConfigure, canDelete: canConfigure, canReport: canRead || resolved === 'hr_manager' }
}
function availablePermissions(role?: string) {
  const permissions = payrollPermissions(role)
  return { ...permissions, canProcess: DATA_API_CONNECTED && permissions.canProcess, canConfigure: DATA_API_CONNECTED && permissions.canConfigure, canDelete: DATA_API_CONNECTED && permissions.canDelete }
}
export function getPayrollPermissions() {
  const actor = useCurrentActorStore.getState().actorId
  return availablePermissions(useUsersStore.getState().users.find(user => user.id === actor)?.role)
}
export function usePayrollPermissions() {
  const actor = useCurrentActorStore(state => state.actorId)
  const users = useUsersStore(state => state.users)
  return availablePermissions(users.find(user => user.id === actor)?.role)
}
