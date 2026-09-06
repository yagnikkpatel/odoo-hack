'use client'

import { useRef } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'

import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { cn } from '@/features/nexacrm/lib/utils'

type TableSearchProps = {
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function TableSearch({ value, onValueChange, placeholder = 'Search…', className }: TableSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn('relative w-36 min-w-0 sm:w-48', className)}>
      <SearchIcon aria-hidden='true' className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2' />
      <Input
        ref={inputRef}
        value={value}
        onChange={event => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        autoComplete='off'
        className='h-7 rounded-md pl-8 pr-7 text-sm'
      />
      {value ? (
        <Button
          type='button'
          variant='ghost'
          size='icon-xs'
          aria-label='Clear search'
          className='text-muted-foreground absolute top-1/2 right-0.5 size-6 -translate-y-1/2'
          onClick={() => {
            onValueChange('')
            inputRef.current?.focus()
          }}
        >
          <XIcon className='size-3' />
        </Button>
      ) : null}
    </div>
  )
}
