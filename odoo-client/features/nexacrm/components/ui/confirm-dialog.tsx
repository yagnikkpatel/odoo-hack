'use client'

// React Imports
import { useState } from 'react'
import type { ReactNode } from 'react'

// Third-party Imports
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle
} from '@/features/nexacrm/components/ui/dialog'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

const POPUP_CLASSNAME =
  'bg-popover text-popover-foreground ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl p-4 text-sm ring-1 duration-100 outline-none sm:max-w-sm'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  // Optional: set by the caller while its own mutation is in flight.
  pending?: boolean
  onConfirm: () => void | Promise<void>
}

const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'destructive',
  pending = false,
  onConfirm
}: ConfirmDialogProps) => {
  const [confirming, setConfirming] = useState(false)

  // Await the handler before closing: an async onConfirm would otherwise tear the dialog
  // down before its mutation settles, leaving a failure to surface over an empty screen.
  // A synchronous onConfirm is only deferred by a microtask, which is not observable.
  const handleConfirm = async () => {
    setConfirming(true)

    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay forceRender />
        <DialogPrimitive.Popup data-slot='dialog-content' className={cn(POPUP_CLASSNAME)}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant='outline' />}>{cancelLabel}</DialogClose>
            <Button variant={variant} disabled={pending || confirming} onClick={handleConfirm}>
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  )
}

export default ConfirmDialog
