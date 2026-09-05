'use client'

// React Imports
import { useState } from 'react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

type EditableTitleProps = {
  value: string
  onCommit: (value: string) => void

  /** Accessible name for the control - the visible text is the value, which may be empty. */
  ariaLabel: string
  placeholder?: string

  /** When false the title renders as plain text: no click target, no input. */
  canEdit?: boolean

  /** Start in edit mode. Used for a record created blank, where the name is the first thing to type. */
  autoEdit?: boolean

  /** Typography for the title - passed by the caller so the panel and the page can differ. */
  className?: string
}

const EditableTitle = ({
  value,
  onCommit,
  ariaLabel,
  placeholder = 'Untitled',
  canEdit = true,
  autoEdit = false,
  className
}: EditableTitleProps) => {
  const [isEditing, setIsEditing] = useState(autoEdit && canEdit)
  const [draft, setDraft] = useState(value)

  const startEditing = () => {
    if (!canEdit) return
    setDraft(value)
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setDraft(value)
    setIsEditing(false)
  }

  const commit = () => {
    const trimmed = draft.trim()

    if (trimmed !== value) onCommit(trimmed)
    setIsEditing(false)
  }

  if (isEditing) {
    return (
      <span className='relative -ms-1.5 inline-block h-7 max-w-[calc(100%+0.75rem)] align-middle'>
        <span
          aria-hidden
          className={cn('invisible block h-7 border border-transparent px-1.5 whitespace-pre', className)}
        >
          {draft || placeholder}
        </span>

        <Input
          value={draft}
          autoFocus
          aria-label={ariaLabel}
          placeholder={placeholder}
          onChange={event => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit()
            }

            if (event.key === 'Escape') {
              event.preventDefault()
              cancelEditing()
            }
          }}
          className={cn('absolute inset-0 h-7 w-full bg-transparent px-1.5 shadow-none', className)}
        />
      </span>
    )
  }

  if (!canEdit) {
    return <span className={cn('block truncate', className)}>{value || placeholder}</span>
  }

  return (
    <Button
      variant='ghost'
      onClick={startEditing}
      className={cn('-ms-1.5 h-7 max-w-[calc(100%+0.75rem)] justify-start px-1.5 font-normal', className)}
    >
      <span className={cn('truncate', !value && 'text-muted-foreground font-normal')}>{value || placeholder}</span>
    </Button>
  )
}

export default EditableTitle
