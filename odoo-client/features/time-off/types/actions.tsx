'use client'

import { toast } from 'sonner'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { useTimeOffPermissions } from '../permissions'
import { useTimeOffStore } from '../store'
import type { TimeOffType } from '../model'

export default function TypeActions({
  type,
  onEdit,
  onDeleted,
  detail = false
}: {
  type: TimeOffType
  onEdit: () => void
  onDeleted?: () => void
  detail?: boolean
}) {
  const { canManageTypes, canDeleteTypes } = useTimeOffPermissions()
  if (detail && !canManageTypes && !canDeleteTypes) return null
  return (
    <RowActionShell
      label={'Actions for ' + type.name}
      viewHref={detail ? undefined : '/time-off/types/' + type.id}
      onEdit={canManageTypes ? onEdit : undefined}
      onDelete={
        canDeleteTypes
          ? async () => {
              const result = await useTimeOffStore.getState().removeType(type.id)
              if (!result.ok) {
                toast.error(result.error)
                return
              }
              toast.success('Time off type deleted')
              onDeleted?.()
            }
          : undefined
      }
      deleteTitle='Delete time off type?'
      deleteDescription='Types linked to allocations or requests cannot be deleted. Archive them instead to preserve history.'
    />
  )
}
