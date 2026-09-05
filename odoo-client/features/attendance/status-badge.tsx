import { Badge } from '@/features/nexacrm/components/ui/badge'
import { ATTENDANCE_STATUSES } from './types'
import type { AttendanceStatus } from './types'

const colors = {
  present: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  absent: 'bg-red-500/10 text-red-700 dark:text-red-400',
  incomplete: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
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
