import { Badge } from '@/features/nexacrm/components/ui/badge'
import type { EmployeeStatus } from '../types'
import { STATUS_LABELS } from '../types'

export default function EmployeeStatusBadge({
  status,
}: {
  status?: EmployeeStatus
}) {
  return status ? (
    <Badge variant={status === 'active' ? 'secondary' : 'outline'}>
      {STATUS_LABELS[status]}
    </Badge>
  ) : (
    <span className="text-muted-foreground">Not set</span>
  )
}
