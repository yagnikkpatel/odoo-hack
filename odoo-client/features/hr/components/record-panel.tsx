'use client'
import { useRef } from 'react'
import type { ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import PreviewSheet from '@/features/nexacrm/components/record/preview-sheet'

export default function RecordPanel({
  title,
  open,
  onClose,
  actions,
  children,
}: {
  title: string
  open: boolean
  onClose: () => void
  href?: string
  actions?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <PreviewSheet
      open={open}
      onClose={onClose}
      title={title}
      initialFocus={ref}
    >
      <div
        ref={ref}
        tabIndex={-1}
        className="flex h-12.5 shrink-0 items-center gap-2 border-b px-4 outline-none"
      >
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {actions}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close panel"
          onClick={onClose}
        >
          <XIcon />
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">{children}</div>
      </ScrollArea>
    </PreviewSheet>
  )
}
