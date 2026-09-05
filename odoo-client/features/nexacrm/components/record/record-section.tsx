'use client'

// React Imports
import type { ReactNode } from 'react'

// Third-party Imports
import { ChevronDownIcon, PlusIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/features/nexacrm/components/ui/collapsible'

export const RecordGroup = ({ title, children }: { title: string; children: ReactNode }) => (
  <Collapsible defaultOpen className='group/group'>
    <CollapsibleTrigger
      render={
        <Button
          variant='ghost'
          className='group/trigger h-7 w-full justify-between px-0 text-sm font-medium hover:bg-transparent aria-expanded:bg-transparent'
        />
      }
    >
      {title}
      <ChevronDownIcon className='text-muted-foreground/60 group-hover/trigger:text-foreground size-4 transition-all group-data-open/group:rotate-180' />
    </CollapsibleTrigger>
    <CollapsibleContent className='space-y-0.5 pt-0.5'>{children}</CollapsibleContent>
  </Collapsible>
)

export const RecordHeading = ({
  title,
  count,
  onAdd,
  addLabel
}: {
  title: string
  count?: number

  /** Omitted when the surface cannot be added to - a read-only tab shows no "+". */
  onAdd?: () => void
  addLabel?: string
}) => (
  <div className='flex items-center justify-between gap-2'>
    <div className='flex items-baseline gap-2'>
      <h2 className='text-sm font-medium'>{title}</h2>
      {count !== undefined ? <span className='text-muted-foreground text-xs tabular-nums'>{count}</span> : null}
    </div>

    {onAdd ? (
      <Button variant='ghost' size='icon-sm' aria-label={addLabel ?? `Add ${title}`} onClick={onAdd}>
        <PlusIcon />
      </Button>
    ) : null}
  </div>
)

export const RecordSubHeading = ({ title, count }: { title: string; count: number }) => (
  <div className='flex items-baseline gap-2 pb-2'>
    <h3 className='text-muted-foreground text-xs font-medium uppercase'>{title}</h3>
    <span className='text-muted-foreground text-xs tabular-nums'>{count}</span>
  </div>
)
