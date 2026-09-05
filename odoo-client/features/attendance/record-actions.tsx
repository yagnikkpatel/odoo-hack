'use client'

import { Button } from '@/features/nexacrm/components/ui/button'
import { useAttendancePermissions } from './permissions'

export default function AttendanceActions({
  onEdit,
}: {
  onEdit: () => void
}) {
  const { canUpdate } = useAttendancePermissions()

  if (!canUpdate) return null

  return (
    <Button variant="outline" size="sm" onClick={onEdit}>
      Correct attendance
    </Button>
  )
}
