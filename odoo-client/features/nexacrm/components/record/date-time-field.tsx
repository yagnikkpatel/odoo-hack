'use client'

// React Imports
import { useState } from 'react'

// Third-party Imports
import { format } from 'date-fns'
import { ChevronDownIcon, XIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Calendar } from '@/features/nexacrm/components/ui/calendar'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/features/nexacrm/components/ui/popover'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

const DEFAULT_TIME = '09:00'

const TIME_INPUT =
  'bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none'

type DateTimeFieldProps = {

  /** ISO timestamp, or undefined when unset. */
  value?: string
  onChange: (next?: string) => void
  canEdit: boolean
  placeholder?: string

  /** Shown when the field is read-only and empty. */
  emptyLabel?: string
}

const DateTimeField = ({
  value,
  onChange,
  canEdit,
  placeholder = 'Add a date',
  emptyLabel = '-'
}: DateTimeFieldProps) => {
  const [open, setOpen] = useState(false)

  const current = value ? new Date(value) : undefined

  if (!canEdit) {
    return <span className='text-sm'>{current ? format(current, 'd MMM, yyyy HH:mm') : emptyLabel}</span>
  }

  const commitDate = (day?: Date) => {
    if (!day) return onChange(undefined)

    const [hours, minutes] = (current ? format(current, 'HH:mm') : DEFAULT_TIME).split(':').map(Number)
    const next = new Date(day)

    next.setHours(hours, minutes, 0, 0)
    onChange(next.toISOString())
  }

  const commitTime = (raw: string) => {
    if (!raw) return

    const [hours, minutes] = raw.split(':').map(Number)
    const next = current ? new Date(current) : new Date()

    next.setHours(hours, minutes, 0, 0)
    onChange(next.toISOString())
  }

  return (
    <div className='flex w-full min-w-0 flex-wrap items-center gap-2'>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant='outline' size='sm' />}
          className='h-8 min-w-30 flex-1 justify-between px-2 font-normal'
        >
          <span className={cn('truncate', !current && 'text-muted-foreground')}>
            {current ? format(current, 'd MMM, yyyy') : placeholder}
          </span>
          <ChevronDownIcon className='text-muted-foreground size-4 shrink-0' />
        </PopoverTrigger>
        <PopoverContent align='start' className='w-auto overflow-hidden p-0'>
          <Calendar
            mode='single'
            selected={current}
            defaultMonth={current}
            captionLayout='dropdown'
            autoFocus
            onSelect={day => {
              commitDate(day)
              setOpen(false)
            }}
          />

          {current ? (
            <div className='border-t p-2'>
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground w-full justify-start'
                onClick={() => {
                  onChange(undefined)
                  setOpen(false)
                }}
              >
                <XIcon /> Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      {current ? (
        <Input
          type='time'
          aria-label='Time'
          value={format(current, 'HH:mm')}
          onChange={event => commitTime(event.target.value)}
          className={cn(TIME_INPUT, 'h-8 w-[5.25rem] shrink-0 px-2 text-sm')}
        />
      ) : null}
    </div>
  )
}

export default DateTimeField
