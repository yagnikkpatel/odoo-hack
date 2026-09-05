'use client'

// React Imports
import type { ReactNode } from 'react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/features/nexacrm/components/ui/dropdown-menu'
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTitle } from '@/features/nexacrm/components/ui/sheet'
import EditableTitle from '@/features/nexacrm/components/record/editable-title'

const RecordSheet = ({
  open,
  onOpenChange,
  title,
  subtitle,
  onRename,
  autoEditTitle = false,
  actions,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string

  /** Muted line under the title - "Created 2 hours ago". */
  subtitle?: string

  /** Omit to render the title as plain text (a draft, or a read-only viewer). */
  onRename?: (value: string) => void

  /** Opens the title in edit mode - used by a record created blank from "+". */
  autoEditTitle?: boolean

  /** Menu items for the footer's "Options"; omitted when there is nothing to do. */
  actions?: ReactNode
  children: ReactNode
}) => (
  <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent
      side='right'
      className='flex w-[min(28rem,94vw)] flex-col gap-0 p-0 data-[side=right]:sm:max-w-[28rem]'
    >
      <div className='shrink-0 border-b px-5 py-4'>
        <SheetTitle className='sr-only'>{title || 'Untitled'}</SheetTitle>

        {onRename ? (
          <EditableTitle
            value={title}
            autoEdit={autoEditTitle}
            onCommit={onRename}
            ariaLabel='Title'
            className='text-base font-semibold tracking-tight'
          />
        ) : (
          <p className='truncate text-base font-semibold tracking-tight'>{title || 'Untitled'}</p>
        )}

        {subtitle ? <p className='text-muted-foreground truncate text-xs'>{subtitle}</p> : null}
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        <div className='space-y-5 px-5 py-4'>{children}</div>
      </ScrollArea>

      {actions ? (
        <div className='flex shrink-0 items-center border-t px-5 py-3'>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant='outline' size='sm' />}>Options</DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-48'>
              {actions}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </SheetContent>
  </Sheet>
)

export default RecordSheet
