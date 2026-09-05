'use client'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

type CalendarChipProps = {
  title: string

  /** One short field - an amount, a due time, a company. Omitted when the module has nothing to add. */
  meta?: string

  /** Muted when the record has no name of its own, matching how the full cards render "Untitled". */
  muted?: boolean
  className?: string
}

const CalendarChip = ({ title, meta, muted, className }: CalendarChipProps) => (
  <span className={cn('bg-card flex min-w-0 flex-col gap-0.5 rounded-md border px-1.5 py-1 text-left', className)}>
    <span className={cn('truncate text-xs leading-4 font-medium', muted && 'text-muted-foreground font-normal')}>
      {title}
    </span>

    {meta ? <span className='text-muted-foreground truncate text-[0.6875rem] leading-4'>{meta}</span> : null}
  </span>
)

export default CalendarChip
