'use client'
import { toast } from 'sonner'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useSchedulesStore } from './store'
import type { WorkingSchedule } from './types'

export default function ScheduleActions({
  schedule,
  onEdit,
  onDeleted,
  detail = false,
}: {
  schedule: WorkingSchedule
  onEdit: () => void
  onDeleted?: () => void
  detail?: boolean
}) {
  const { can } = useCurrentUser()
  return (
    <RowActionShell
      label={'Actions for ' + schedule.name}
      viewHref={detail ? undefined : '/attendance/schedules/' + schedule.id}
      onEdit={can('records:update') ? onEdit : undefined}
      onDelete={
        can('records:delete')
          ? () => {
              const result = useSchedulesStore.getState().remove(schedule.id)
              if (!result.ok) {
                toast.error(result.error)
                return
              }
              onDeleted?.()
            }
          : undefined
      }
      deleteTitle="Delete working schedule?"
      deleteDescription="Only unassigned schedules can be deleted. This removes the pattern from this preview session."
    />
  )
}
