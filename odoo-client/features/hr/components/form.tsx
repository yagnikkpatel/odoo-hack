'use client'
import type { FormEvent, ReactNode } from 'react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Label } from '@/features/nexacrm/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/nexacrm/components/ui/dialog'
import SearchableSelect from '@/features/nexacrm/components/ui/searchable-select'

export function FormField({
  label,
  id,
  children,
}: {
  label: string
  id: string
  children: ReactNode
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
export function Choice({
  id,
  value,
  options,
  onChange,
  placeholder,
  disabled,
  searchable,
}: {
  id: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  // Omit to let SearchableSelect decide by list length; set for pickers that
  // should always be searchable regardless of how small the list happens to be.
  searchable?: boolean
}) {
  return (
    <SearchableSelect
      id={id}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      searchable={searchable}
    />
  )
}

// Matches the employee/contract modal: only the body scrolls, actions remain visible.
export function EditorDialog({
  title,
  description,
  children,
  error,
  submitLabel = 'Save',
  pending = false,
  onSubmit,
  onClose,
}: {
  title: string
  description: string
  children: ReactNode
  error?: string | null
  submitLabel?: string
  // Optional: set while an async onSubmit is in flight to block re-submission.
  pending?: boolean
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onClose: () => void
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden pb-0 sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex min-h-0 flex-col gap-4">
          <div className="-mx-1 -my-1 min-h-0 space-y-5 overflow-y-auto px-1 py-1">
            {children}
          </div>
          {error && (
            <p role="alert" className="text-destructive shrink-0 text-sm">
              {error}
            </p>
          )}
          <DialogFooter className="mb-0 shrink-0">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
