'use client'
import { toast } from 'sonner'
import { Button } from '@/features/nexacrm/components/ui/button'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useAttendanceStore } from './store'
import { attendanceStatus } from './types'
import type { Attendance } from './types'

export default function AttendanceActions({
  record,
  onEdit,
  onDeleted,
  detail = false,
}: {
  record: Attendance
  onEdit: () => void
  onDeleted?: () => void
  detail?: boolean
}) {
  const { can } = useCurrentUser()
  return (
    <div className="flex items-center gap-1">
      {detail && can('records:update') && (
        <>
          <Button variant="outline" size="sm" onClick={onEdit}>
            Correct attendance
          </Button>
          {attendanceStatus(record) === 'open' && (
            <Button
              size="sm"
              onClick={() => {
                const result = useAttendanceStore.getState().checkOut(record.id)
                if (!result.ok) toast.error(result.error)
              }}
            >
              Check out
            </Button>
          )}
        </>
      )}
      <RowActionShell
        label="Attendance actions"
        viewHref={detail ? undefined : '/attendance/' + record.id}
        onEdit={can('records:update') ? onEdit : undefined}
        onDelete={
          can('records:delete')
            ? () => {
                useAttendanceStore.getState().remove(record.id)
                onDeleted?.()
              }
            : undefined
        }
        deleteTitle="Delete attendance?"
        deleteDescription="This removes the entry and its correction history from the preview. Reloading restores demo records."
      />
    </div>
  )
}
