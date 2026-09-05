import { Badge } from '@/features/nexacrm/components/ui/badge'
import { CONTRACT_STATUSES } from '../types'
import type { ContractStatus } from '../types'

const colors: Record<ContractStatus, string> = {
  running:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  expired: 'border-border bg-muted text-muted-foreground',
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
