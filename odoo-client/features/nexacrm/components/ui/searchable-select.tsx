'use client'

import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { Button } from './button'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from './select'
import { cn } from '@/features/nexacrm/lib/utils'
import { filterOptions, SEARCHABLE_OPTION_THRESHOLD } from '@/features/nexacrm/lib/option-search'

export type SelectOption = { value: string; label: string; disabled?: boolean }
type Props = {
  id?: string
  label?: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  selectedContent?: ReactNode
  searchable?: boolean
}

/** The template's select for short lists; its existing popover/command pattern for long lists. */
export default function SearchableSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Choose…',
  className,
  selectedContent,
  searchable = options.length >= SEARCHABLE_OPTION_THRESHOLD
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const popupId = useId()
  const selected = options.find(option => option.value === value)
  const visible = filterOptions(options, query, option => option.label)
  if (!searchable)
    return (
      <Select
        items={options}
        value={value}
        disabled={disabled}
        onValueChange={next => {
          if (next !== null) onChange(String(next))
        }}
      >
        <SelectTrigger id={id} aria-label={label} className={cn('w-full min-w-0', className)}>
          <SelectValue placeholder={placeholder}>{selectedContent}</SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {options.map(option => (
              <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next)
        setQuery('')
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type='button'
            role='combobox'
            aria-label={label}
            aria-expanded={open}
            aria-controls={open ? popupId : undefined}
            aria-haspopup='dialog'
            disabled={disabled}
            variant='outline'
            className={cn('h-8 w-full min-w-0 justify-between gap-1.5 rounded-lg px-2.5 text-sm font-normal', className)}
          />
        }
      >
        <span
          className={cn('min-w-0 flex-1 truncate text-left', !selected && !selectedContent && 'text-muted-foreground')}
        >
          {selectedContent ?? selected?.label ?? placeholder}
        </span>
        <ChevronDownIcon className='text-muted-foreground size-4 shrink-0' />
      </PopoverTrigger>
      <PopoverContent
        id={popupId}
        align='start'
        initialFocus={inputRef}
        aria-label={label ? label + ' options' : 'Choose an option'}
        className='w-(--anchor-width) max-w-[calc(100vw-2rem)] min-w-52 overflow-hidden p-0'
      >
        <Command
          shouldFilter={false}
          className='max-h-[min(22rem,var(--available-height))] [&_[data-slot=command-input-wrapper]]:p-0 [&_[data-slot=command-input-wrapper]]:pb-1'
        >
          <CommandInput
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            placeholder={label ? `Search ${label.toLowerCase()}…` : 'Search options…'}
            aria-label={label ? `Search ${label.toLowerCase()}` : 'Search options'}
          />
          <CommandList className='max-h-64 min-h-0 overscroll-contain'>
            <CommandEmpty>No options match your search.</CommandEmpty>
            <CommandGroup className='p-0'>
              {visible.map(option => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  data-checked={option.value === value || undefined}
                  onSelect={() => {
                    onChange(option.value)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <span className='min-w-0 flex-1 truncate' title={option.label}>
                    {option.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
