'use client'

import { useId, useState } from 'react'
import { ClockIcon } from 'lucide-react'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import SearchableSelect from './searchable-select'
import { cn } from '@/features/nexacrm/lib/utils'
import { isTimeValue } from '@/features/nexacrm/lib/date-time'

type Props = {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  className?: string
  placeholder?: string
}

const numbers = (length: number) =>
  Array.from({ length }, (_, index) => {
    const value = String(index).padStart(2, '0')
    return { value, label: value }
  })
const hours = numbers(24)
const minutes = numbers(60)

export function TimePicker({ id, label, value, onChange, required, disabled, className, placeholder = 'Select time' }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value || '09:00')
  const inputId = useId()
  const popupId = useId()
  const [hour, minute] = (isTimeValue(draft) ? draft : '09:00').split(':')
  const commit = (next: string) => {
    onChange(next)
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (next) setDraft(isTimeValue(value) ? value : '09:00')
        setOpen(next)
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type='button'
            variant='outline'
            role='combobox'
            aria-haspopup='dialog'
            aria-expanded={open}
            aria-controls={open ? popupId : undefined}
            aria-label={label}
            aria-required={required || undefined}
            disabled={disabled}
            className={cn('h-8 w-full min-w-0 justify-between px-2.5 font-normal tabular-nums', className)}
          />
        }
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>{value || placeholder}</span>
        <ClockIcon className='text-muted-foreground size-4 shrink-0' />
      </PopoverTrigger>
      <PopoverContent
        id={popupId}
        align='start'
        aria-label={label ? `${label} picker` : 'Choose time'}
        className='max-h-(--available-height) w-64 max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto p-3'
      >
        <div className='grid gap-1.5'>
          <Label htmlFor={inputId}>
            Time <span className='text-muted-foreground font-normal'>(24-hour)</span>
          </Label>
          <Input
            id={inputId}
            aria-label='Time in 24-hour format'
            type='text'
            value={draft}
            placeholder='HH:mm'
            autoComplete='off'
            maxLength={5}
            className='tabular-nums'
            aria-invalid={!isTimeValue(draft)}
            onInput={event => setDraft(event.currentTarget.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (isTimeValue(draft)) commit(draft)
              }
            }}
          />
        </div>
        <div className='grid grid-cols-2 gap-2'>
          <div className='grid gap-1.5'>
            <Label htmlFor={inputId + '-hour'}>Hour</Label>
            <SearchableSelect
              id={inputId + '-hour'}
              label='Hour'
              value={hour}
              options={hours}
              onChange={next => setDraft(`${next}:${minute}`)}
            />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor={inputId + '-minute'}>Minute</Label>
            <SearchableSelect
              id={inputId + '-minute'}
              label='Minute'
              value={minute}
              options={minutes}
              onChange={next => setDraft(`${hour}:${next}`)}
            />
          </div>
        </div>
        {!isTimeValue(draft) && (
          <p role='status' className='text-destructive text-xs'>
            Use HH:mm, from 00:00 to 23:59.
          </p>
        )}
        <div className='-mx-3 -mb-3 flex items-center gap-1 border-t p-2'>
          {!required && (
            <Button type='button' variant='ghost' size='sm' disabled={!value} onClick={() => commit('')}>
              Clear
            </Button>
          )}
          <Button type='button' variant='ghost' size='sm' className='ml-auto' onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type='button' size='sm' disabled={!isTimeValue(draft)} onClick={() => commit(draft)}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
