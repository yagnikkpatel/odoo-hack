'use client'

import { useId, useState } from 'react'
import { format, addMonths } from 'date-fns'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from './button'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import SearchableSelect from './searchable-select'
import { cn } from '@/features/nexacrm/lib/utils'
import { dateValue, dateWithinBounds, parseDateValue } from '@/features/nexacrm/lib/date-time'

export type DatePickerProps = {
  id?: string
  label?: string
  value: string
  onChange: (value: string) => void
  min?: string
  max?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
  className?: string
}

/** A themed, keyboard-accessible alternative to the browser's date popup. */
export function DatePicker({
  id,
  label,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  placeholder = 'Select date',
  className
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const popupId = useId()
  const [month, setMonth] = useState(() => parseDateValue(value) ?? parseDateValue(min ?? '') ?? new Date())
  const selected = parseDateValue(value)
  const today = dateValue(new Date())
  const start = parseDateValue(min ?? '')
  const end = parseDateValue(max ?? '')
  const firstYear = start?.getFullYear() ?? Math.min(new Date().getFullYear() - 100, month.getFullYear())
  const lastYear = end?.getFullYear() ?? Math.max(new Date().getFullYear() + 50, month.getFullYear())
  const select = (next: string) => {
    if (next && !dateWithinBounds(next, min, max)) return
    onChange(next)
    setOpen(false)
  }
  const monthAllowed = (next: Date) => {
    const key = dateValue(next).slice(0, 7)
    return (!min || key >= min.slice(0, 7)) && (!max || key <= max.slice(0, 7))
  }
  return (
    <Popover
      open={open}
      onOpenChange={next => {
        if (next) setMonth(selected ?? start ?? new Date())
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
            className={cn('h-8 w-full min-w-0 justify-between px-2.5 font-normal', className)}
          />
        }
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? format(selected, 'dd MMM yyyy') : placeholder}
        </span>
        <CalendarIcon className='text-muted-foreground size-4 shrink-0' />
      </PopoverTrigger>
      <PopoverContent
        id={popupId}
        align='start'
        aria-label={label ? `${label} calendar` : 'Choose date'}
        className='max-h-(--available-height) w-72 max-w-[calc(100vw-2rem)] gap-0 overflow-y-auto p-0'
      >
        <div className='flex items-center gap-1 border-b p-2'>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='Previous month'
            disabled={!monthAllowed(addMonths(month, -1))}
            onClick={() => setMonth(addMonths(month, -1))}
          >
            <ChevronLeftIcon />
          </Button>
          <SearchableSelect
            label='Month'
            value={String(month.getMonth())}
            className='min-w-0 flex-1 border-transparent px-1.5'
            options={Array.from({ length: 12 }, (_, index) => ({
              value: String(index),
              label: format(new Date(2024, index, 1), 'MMMM'),
              disabled: !monthAllowed(new Date(month.getFullYear(), index, 1))
            }))}
            onChange={next => setMonth(new Date(month.getFullYear(), Number(next), 1))}
          />
          <SearchableSelect
            label='Year'
            value={String(month.getFullYear())}
            className='w-18 border-transparent px-1.5'
            options={Array.from({ length: Math.max(0, lastYear - firstYear + 1) }, (_, index) => ({
              value: String(firstYear + index),
              label: String(firstYear + index)
            }))}
            onChange={next => {
              const date = new Date(Number(next), month.getMonth(), 1)
              setMonth(start && date < start ? start : end && date > end ? end : date)
            }}
          />
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='Next month'
            disabled={!monthAllowed(addMonths(month, 1))}
            onClick={() => setMonth(addMonths(month, 1))}
          >
            <ChevronRightIcon />
          </Button>
        </div>
        <Calendar
          mode='single'
          selected={selected}
          month={month}
          onMonthChange={setMonth}
          startMonth={start}
          endMonth={end}
          hideNavigation
          className='w-full p-3 [--cell-size:--spacing(8)]'
          classNames={{ month_caption: 'hidden', month: 'flex w-full flex-col gap-0' }}
          disabled={day => !dateWithinBounds(dateValue(day), min, max)}
          onSelect={day => {
            if (day) select(dateValue(day))
          }}
        />
        <div className='flex items-center justify-between border-t p-2'>
          <Button type='button' variant='ghost' size='sm' disabled={required || !value} onClick={() => select('')}>
            Clear
          </Button>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={!dateWithinBounds(today, min, max)}
            onClick={() => select(today)}
          >
            Today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
