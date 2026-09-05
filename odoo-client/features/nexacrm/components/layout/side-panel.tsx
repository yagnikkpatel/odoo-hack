'use client'

// React Imports
import type { ReactNode } from 'react'

// Third-party Imports
import { PanelLeftIcon, PanelRightIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/features/nexacrm/components/ui/sheet'

// Hook Imports
import { useMediaQuery } from '@/features/nexacrm/hooks/use-media-query'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

export const SIDE_PANEL_BREAKPOINTS = {
  lg: { query: '(min-width: 1024px)', triggerHidden: 'lg:hidden' },
  xl: { query: '(min-width: 1280px)', triggerHidden: 'xl:hidden' }
} as const

export type SidePanelBreakpoint = keyof typeof SIDE_PANEL_BREAKPOINTS

type SidePanelProps = {
  side?: 'left' | 'right'
  breakpoint?: SidePanelBreakpoint
  open: boolean
  onOpenChange: (open: boolean) => void

  /** Required - the Sheet needs a title for screen readers even when it is visually hidden. */
  title: string
  description?: string

  /** Classes for the inline column only; the Sheet sizes itself. */
  className?: string
  children: ReactNode
}

const SidePanel = ({
  side = 'left',
  breakpoint = 'xl',
  open,
  onOpenChange,
  title,
  description,
  className,
  children
}: SidePanelProps) => {
  const isColumn = useMediaQuery(SIDE_PANEL_BREAKPOINTS[breakpoint].query)

  if (isColumn) {
    return <aside className={cn('min-w-0', className)}>{children}</aside>
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className='w-[min(22rem,88vw)] gap-0 p-0 sm:max-w-none'>
        <SheetHeader className='border-b px-4 py-3'>
          <SheetTitle className='pr-4 text-sm'>{title}</SheetTitle>
          {description ? <SheetDescription className='text-xs'>{description}</SheetDescription> : null}
        </SheetHeader>
        <ScrollArea className='min-h-0 flex-1'>
          <div className='px-4 py-4'>{children}</div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

export const SidePanelTrigger = ({
  side = 'left',
  breakpoint = 'xl',
  label,
  onClick,
  className
}: {
  side?: 'left' | 'right'
  breakpoint?: SidePanelBreakpoint
  label: string
  onClick: () => void
  className?: string
}) => (
  <Button
    variant='ghost'
    size='icon-sm'
    aria-label={label}
    onClick={onClick}
    className={cn(
      'text-muted-foreground hover:text-foreground shrink-0',
      SIDE_PANEL_BREAKPOINTS[breakpoint].triggerHidden,
      className
    )}
  >
    {side === 'left' ? <PanelLeftIcon /> : <PanelRightIcon />}
  </Button>
)

export default SidePanel
