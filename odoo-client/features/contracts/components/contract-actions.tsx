'use client'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useContractsStore } from '../store'
import type { Contract } from '../types'

export default function ContractActions({
  contract,
  onEdit,
  onDeleted,
  showView = true,
}: {
  contract: Contract
  onEdit: () => void
  onDeleted?: () => void
  showView?: boolean
}) {
  const { can } = useCurrentUser()
  const remove = useContractsStore((state) => state.remove)
  return (
    <RowActionShell
      label={'Actions for ' + contract.name}
      viewHref={showView ? '/contracts/' + contract.id : undefined}
      onEdit={can('records:update') ? onEdit : undefined}
      onDelete={
        can('records:delete')
          ? () => {
              remove(contract.id)
              onDeleted?.()
            }
          : undefined
      }
      deleteTitle="Delete contract?"
      deleteDescription="Remove this contract from the demo history? This cannot be undone in this session. Reloading restores the demo records."
    />
  )
}
