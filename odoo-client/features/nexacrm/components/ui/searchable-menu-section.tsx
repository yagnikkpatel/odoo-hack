'use client'

import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { SearchIcon } from 'lucide-react'
import { Input } from './input'
import { filterOptions, SEARCHABLE_OPTION_THRESHOLD } from '@/features/nexacrm/lib/option-search'

/** Search stays above the scrolling items, while the original menu items retain their actions. */
export default function SearchableMenuSection<T>({
  items,
  getLabel,
  label,
  children
}: {
  items: readonly T[]
  getLabel: (item: T) => string
  label: string
  children: (items: T[], searching: boolean) => ReactNode
}) {
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  if (items.length < SEARCHABLE_OPTION_THRESHOLD) return children([...items], false)
  const visible = filterOptions(items, query, getLabel)
  return (
    <div className='flex min-h-0 flex-col'>
      <div className='bg-popover relative shrink-0 pb-1'>
        <SearchIcon className='text-muted-foreground pointer-events-none absolute top-4 left-2 size-3.5 -translate-y-1/2' />
        <Input
          autoFocus
          value={query}
          onInput={event => setQuery(event.currentTarget.value)}
          aria-label={'Search ' + label}
          placeholder={'Search ' + label + '…'}
          className='h-8 pl-7'
          onKeyDown={event => {
            if (event.key === 'Escape' || event.key === 'Tab') return
            event.stopPropagation()
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const options = listRef.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([data-disabled])')
              const target = event.key === 'ArrowDown' ? options?.[0] : options?.[options.length - 1]
              target?.focus()
            }
          }}
        />
      </div>
      <div ref={listRef} className='max-h-64 min-h-0 overflow-y-auto overscroll-contain'>
        {visible.length ? (
          children(visible, !!query.trim())
        ) : (
          <p role='status' className='text-muted-foreground px-3 py-5 text-center text-sm'>
            No options match your search.
          </p>
        )}
      </div>
    </div>
  )
}
