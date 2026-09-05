'use client'

// React Imports
import { useState } from 'react'

// Third-party Imports
import { CheckIcon } from 'lucide-react'

// Component Imports
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/features/nexacrm/components/ui/dialog'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'

// Util Imports
import type { BadgeTone } from '@/features/nexacrm/lib/badge-tone'
import { BADGE_TONES } from '@/features/nexacrm/lib/badge-tone'
import { cn } from '@/features/nexacrm/lib/utils'

const TONE_LABELS: Record<BadgeTone, string> = {
  neutral: 'Neutral',
  info: 'Blue',
  purple: 'Purple',
  success: 'Green',
  warning: 'Orange',
  danger: 'Red'
}

type StageEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  label: string
  tone: BadgeTone
  onSave: (label: string, tone: BadgeTone) => void
}

const StageEditDialog = ({ open, onOpenChange, label, tone, onSave }: StageEditDialogProps) => {
  const [draftLabel, setDraftLabel] = useState(label)
  const [draftTone, setDraftTone] = useState<BadgeTone>(tone)

  const [wasOpen, setWasOpen] = useState(open)

  if (open !== wasOpen) {
    setWasOpen(open)

    if (open) {
      setDraftLabel(label)
      setDraftTone(tone)
    }
  }

  const trimmed = draftLabel.trim()

  const submit = () => {
    if (!trimmed) return

    onSave(trimmed, draftTone)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>Edit stage</DialogTitle>
          <DialogDescription>Rename this stage and choose the colour its badge uses.</DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='stage-label'>Name</Label>
            <Input
              id='stage-label'
              value={draftLabel}
              autoFocus
              onChange={event => setDraftLabel(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') submit()
              }}
              placeholder='Stage name'
            />
          </div>

          <div className='space-y-2'>
            <Label>Colour</Label>
            <div className='flex flex-wrap gap-2'>
              {(Object.keys(BADGE_TONES) as BadgeTone[]).map(option => (
                <Button
                  key={option}
                  variant='ghost'
                  onClick={() => setDraftTone(option)}
                  aria-label={TONE_LABELS[option]}
                  aria-pressed={draftTone === option}
                  className={cn('h-auto rounded-full p-0')}
                >
                  <Badge variant='secondary' className={cn('gap-1', BADGE_TONES[option])}>
                    {draftTone === option ? <CheckIcon className='size-3' /> : null}
                    {trimmed || TONE_LABELS[option]}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant='outline' />}>Cancel</DialogClose>
          <Button onClick={submit} disabled={!trimmed}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default StageEditDialog
