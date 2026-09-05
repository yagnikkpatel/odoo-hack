import { Badge } from '@/features/nexacrm/components/ui/badge'
import { PAYRUN_STATUSES } from '../types'
import type { PayrollStatus } from '../types'

const styles: Record<PayrollStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  computed: 'bg-amber-50 text-amber-700',
  validated: 'bg-violet-50 text-violet-700',
  paid: 'bg-emerald-50 text-emerald-700'
}
export default function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  return (
    <Badge variant='secondary' className={styles[status]}>
      {PAYRUN_STATUSES[status]}
    </Badge>
  )
}
