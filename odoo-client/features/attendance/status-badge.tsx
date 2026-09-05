import { Badge } from '@/features/nexacrm/components/ui/badge'
import { ATTENDANCE_STATUSES } from './types'
import type { AttendanceStatus } from './types'
const colors = {
  complete: 'bg-emerald-500/10 text-emerald-700',
  open: 'bg-blue-500/10 text-blue-700',
  missing: 'bg-amber-500/10 text-amber-700',
}
export default function AttendanceStatusBadge({
  status,
}: {
  status: AttendanceStatus
}) {
  return (
    <Badge variant="secondary" className={colors[status]}>
      {ATTENDANCE_STATUSES[status]}
    </Badge>
  )
}
