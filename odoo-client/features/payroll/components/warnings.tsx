import { TriangleAlertIcon } from 'lucide-react'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Card } from '@/features/nexacrm/components/ui/card'
import type { PayrollWarning } from '../types'

export default function PayrollWarnings({
  warnings,
  title = 'Payroll warnings'
}: {
  warnings: PayrollWarning[]
  title?: string
}) {
  if (!warnings.length) return null
  return (
    <Card className='gap-3 border-amber-500/30 bg-amber-500/5 p-4'>
      <h2 className='flex items-center gap-2 text-sm font-semibold'>
        <TriangleAlertIcon className='size-4 text-amber-600' />
        {title}
        <span className='text-muted-foreground font-normal'>({warnings.length})</span>
      </h2>
      <ul className='space-y-2 text-sm'>
        {warnings.map((warning, index) => (
          <li key={`${warning.code}-${warning.employeeId ?? ''}-${index}`} className='flex flex-wrap items-start gap-2'>
            <Badge variant='outline' className={warning.blocking ? 'border-rose-200 text-rose-700' : undefined}>
              {warning.blocking ? 'Blocks validation' : 'Review'}
            </Badge>
            <span className='min-w-0 flex-1'>{warning.message}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
