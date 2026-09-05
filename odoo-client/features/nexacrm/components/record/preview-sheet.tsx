'use client'

// React Imports
import type { ReactNode, RefObject } from 'react'

// Third-party Imports
import { Dialog } from '@base-ui/react/dialog'

// Component Imports
import { SheetTitle } from '@/features/nexacrm/components/ui/sheet'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

const PreviewSheet = ({
  open,
  onClose,
  title,
  initialFocus,
  className,
  children
}: {
  open: boolean
  onClose: () => void

  /** Accessible name for the panel - the visible heading is composed by the caller. */
  title: string

  /** Where focus lands on open. Without it the Sheet focuses the editable name and rings it. */
  initialFocus?: RefObject<HTMLElement | null>
  className?: string
  children: ReactNode
}) => (
  <Dialog.Root open={open} modal={false} onOpenChange={value => (value ? undefined : onClose())}>
    <Dialog.Portal data-slot='sheet-portal'>
      <Dialog.Popup
        data-slot='sheet-content'
        data-side='right'
        initialFocus={initialFocus}
        className={cn(
          'bg-popover text-popover-foreground fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col gap-0 border-l bg-clip-padding text-sm shadow-lg transition duration-200 ease-in-out sm:w-md',
          'data-ending-style:translate-x-10 data-ending-style:opacity-0',
          'data-starting-style:translate-x-10 data-starting-style:opacity-0',
          className
        )}
      >
        <SheetTitle className='sr-only'>{title}</SheetTitle>
        {children}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
)

export default PreviewSheet
