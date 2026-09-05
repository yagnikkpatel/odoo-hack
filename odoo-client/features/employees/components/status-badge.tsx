import { Badge } from '@/features/nexacrm/components/ui/badge'
import type { EmployeeStatus } from '../types'
import { STATUS_LABELS } from '../types'

export default function EmployeeStatusBadge({
  status,
}: {
  status?: EmployeeStatus
}) {
  if (!status) return <span className="text-muted-foreground">Not set</span>
  if (status === 'active')
    return <Badge variant="secondary">{STATUS_LABELS.active}</Badge>
  return <Badge variant="outline">{STATUS_LABELS.inactive}</Badge>
}
