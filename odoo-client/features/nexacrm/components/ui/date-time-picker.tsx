'use client'

import { DatePicker } from './date-picker'
import { TimePicker } from './time-picker'
import { withDate } from '@/features/nexacrm/lib/date-time'

type Props = {
  id?: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

/** The same controls in forms, employee sidebars and calendar event editing. */
export function DateTimePicker({ id, label, value, onChange, required, disabled, placeholder }: Props) {
  const [date = '', time = ''] = value.split('T')
  return (
    <div className='flex w-full min-w-0 flex-wrap items-center gap-2'>
      <DatePicker
        id={id}
        label={`${label} date`}
        value={date}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
        className='min-w-36 flex-1'
        onChange={next => onChange(withDate(value, next))}
      />
      <TimePicker
        label={`${label} time`}
        value={time}
        required
        disabled={disabled || !date}
        className='w-24 shrink-0'
        onChange={next => onChange(`${date}T${next}`)}
      />
    </div>
  )
}
