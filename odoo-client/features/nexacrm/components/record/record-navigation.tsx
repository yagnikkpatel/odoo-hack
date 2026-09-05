'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ChevronDownIcon, ChevronUpIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'

const RecordNavigation = ({
  index,
  total,
  moduleLabel,
  previousHref,
  nextHref
}: {
  index: number
  total: number
  moduleLabel: string
  previousHref?: string
  nextHref?: string
}) => {
  if (index < 0 || total === 0) return null

  return (
    <div className='flex shrink-0 items-center gap-1'>
      <span className='text-muted-foreground hidden text-xs tabular-nums md:inline'>
        {index + 1} of {total} in {moduleLabel}
      </span>

      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Previous record'
        disabled={!previousHref}
        nativeButton={!previousHref}
        render={previousHref ? <Link href={previousHref} /> : undefined}
        className='text-muted-foreground hover:text-foreground'
      >
        <ChevronUpIcon />
      </Button>

      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Next record'
        disabled={!nextHref}
        nativeButton={!nextHref}
        render={nextHref ? <Link href={nextHref} /> : undefined}
        className='text-muted-foreground hover:text-foreground'
      >
        <ChevronDownIcon />
      </Button>
    </div>
  )
}

export default RecordNavigation
