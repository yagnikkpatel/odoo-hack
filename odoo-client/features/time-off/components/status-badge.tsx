import { Badge } from '@/features/nexacrm/components/ui/badge'
import { STATUS_LABELS } from '../model'
import type { RequestStatus } from '../model'

const styles: Record<RequestStatus, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  refused: 'bg-rose-50 text-rose-700',
  cancelled: 'bg-muted text-muted-foreground'
}
export default function TimeOffStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge variant='secondary' className={styles[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  )
}
