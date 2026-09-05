'use client'

import { useId, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

type OtpInputProps = {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
  /** Wired to the surrounding field label / error message. */
  id?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

/**
 * Segmented one-time-code field. A single real input sits transparently over the
 * slots so paste, autofill and mobile SMS suggestions all keep working, while the
 * slots below render the digits in the nexacrm surface style.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = false,
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid
}: OtpInputProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const inputRef = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)

  const digits = value.split('')
  // Once the code is complete every slot stays lit rather than pointing past the end.
  const activeIndex = Math.min(value.length, length - 1)

  return (
    <div
      className={cn('relative', disabled && 'pointer-events-none opacity-50')}
      onClick={() => inputRef.current?.focus()}
    >
      <input
        ref={inputRef}
        id={inputId}
        type='text'
        inputMode='numeric'
        autoComplete='one-time-code'
        pattern={`[0-9]{${length}}`}
        maxLength={length}
        required
        autoFocus={autoFocus}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // `onInput` (not `onChange`) so a native autofill of the whole code registers.
        onInput={event => onChange(event.currentTarget.value.replace(/\D/g, '').slice(0, length))}
        className='absolute inset-0 z-10 h-full w-full cursor-text opacity-0 outline-none'
      />

      <div className='flex items-center gap-2' aria-hidden>
        {Array.from({ length }, (_, index) => {
          const isActive = focused && index === activeIndex

          return (
            <div
              key={index}
              className={cn(
                'border-input bg-background/80 dark:bg-input/60 flex h-11 flex-1 items-center justify-center rounded-lg border text-base font-medium transition-colors',
                isActive && 'border-ring ring-ring/50 z-0 ring-3',
                invalid && 'border-destructive ring-destructive/20 dark:ring-destructive/40'
              )}
            >
              {digits[index] ?? ''}
              {isActive && !digits[index] ? <span className='bg-foreground h-4 w-px animate-pulse' /> : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
