import { Badge } from '@/features/nexacrm/components/ui/badge'
import { CONTRACT_STATUSES } from '../types'
import type { ContractStatus } from '../types'

const colors: Record<ContractStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  expired: 'bg-muted text-muted-foreground border-border',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
}
export default function ContractStatusBadge({
  status,
}: {
  status: ContractStatus
}) {
  return (
    <Badge variant="outline" className={colors[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {CONTRACT_STATUSES[status]}
    </Badge>
  )
}
