'use client'

// React Imports
import { useState } from 'react'
import type { ReactNode } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { CheckIcon, ChevronDownIcon, PencilIcon, PlusIcon, XIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/features/nexacrm/components/ui/collapsible'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/features/nexacrm/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/features/nexacrm/components/ui/popover'

/** An option in the "+" picker. */
export type LinkableOption = {
  id: string
  label: string

  /** Trailing detail in the picker row (an amount, a job title). */
  meta?: ReactNode
  icon?: ReactNode
}

export type RelatedLinkable = {
  available: LinkableOption[]

  /** Ids already linked to THIS record - ticked in the list, and un-linked when picked again. */
  linkedIds?: string[]

  /** `isLinked` is what the option's tick showed, so the caller knows which way to write. */
  onToggle: (id: string, isLinked: boolean) => void
  addLabel: string
  searchPlaceholder: string

  /** Shown when there is no record of this type at all. */
  emptyPickerLabel: string
}

export type RelatedEditable = {
  options: LinkableOption[]

  /** The currently linked record, ticked in the list. */
  selectedId?: string
  onSelect: (id: string) => void

  /** Adds a "None" entry. Omit when the relation is required. */
  onClear?: () => void
  editLabel: string
  searchPlaceholder: string
  emptyPickerLabel: string
}

export const RelatedRecordSection = ({
  title,
  count,
  meta,
  linkable,
  editable,
  emptyLabel,
  children
}: {
  title: string
  count: number

  /** Aggregate shown beside the count - "$84K open". */
  meta?: ReactNode
  linkable?: RelatedLinkable
  editable?: RelatedEditable
  emptyLabel: string
  children: ReactNode
}) => {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <section className='space-y-2'>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='text-sm font-medium'>
          {title} <span className='text-muted-foreground tabular-nums'>{count}</span>
        </h2>

        <span className='flex items-center gap-1.5'>
          {meta ? <span className='text-muted-foreground text-xs tabular-nums'>{meta}</span> : null}

          {linkable ? (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger render={<Button variant='ghost' size='icon-sm' aria-label={linkable.addLabel} />}>
                <PlusIcon />
              </PopoverTrigger>
              <PopoverContent align='end' className='w-64 p-0'>
                <Command>
                  <CommandInput placeholder={linkable.searchPlaceholder} />
                  <CommandList>
                    <CommandEmpty>{linkable.emptyPickerLabel}</CommandEmpty>
                    <CommandGroup>
                      {linkable.available.map(option => {
                        const isLinked = Boolean(linkable.linkedIds?.includes(option.id))

                        return (
                          <CommandItem
                            key={option.id}
                            value={option.label}
                            data-checked={isLinked || undefined}
                            onSelect={() => {
                              linkable.onToggle(option.id, isLinked)
                              setPickerOpen(false)
                            }}
                          >
                            {option.icon}
                            <span className='min-w-0 flex-1 truncate'>{option.label}</span>
                            {option.meta ? (
                              <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>{option.meta}</span>
                            ) : null}
                          </CommandItem>
                        )
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : null}

          {editable ? (
            <Popover open={editorOpen} onOpenChange={setEditorOpen}>
              <PopoverTrigger render={<Button variant='ghost' size='icon-sm' aria-label={editable.editLabel} />}>
                <PencilIcon className='size-3.5' />
              </PopoverTrigger>
              <PopoverContent align='end' className='w-auto min-w-15 p-0'>
                <Command>
                  <CommandInput placeholder={editable.searchPlaceholder} />
                  <CommandList>
                    <CommandEmpty>{editable.emptyPickerLabel}</CommandEmpty>
                    <CommandGroup>
                      {editable.onClear ? (
                        <CommandItem
                          value='__none__'
                          onSelect={() => {
                            editable.onClear?.()
                            setEditorOpen(false)
                          }}
                          className='[&>svg:last-child]:hidden'
                        >
                          <span className='text-muted-foreground'>None</span>
                          {editable.selectedId ? null : <CheckIcon className='ml-auto size-4' />}
                        </CommandItem>
                      ) : null}

                      {editable.options.map(option => (
                        <CommandItem
                          key={option.id}
                          value={option.label}
                          onSelect={() => {
                            editable.onSelect(option.id)
                            setEditorOpen(false)
                          }}
                          data-checked={option.id === editable.selectedId || undefined}
                          className='justify-between'
                        >
                          <span className='flex min-w-0 items-center gap-2'>
                            {option.icon}
                            <span className='min-w-0 truncate'>{option.label}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : null}
        </span>
      </div>

      {count > 0 ? (
        <ul className='space-y-1'>{children}</ul>
      ) : (
        <p className='text-muted-foreground text-sm'>{emptyLabel}</p>
      )}
    </section>
  )
}

export const RelatedRecordRow = ({
  href,
  label,
  icon,
  meta,
  onUnlink,
  unlinkLabel,
  children
}: {
  href?: string
  label: string
  icon?: ReactNode

  /** Trailing detail on the row itself - a stage badge, an amount, a "Primary" chip. */
  meta?: ReactNode

  /** Omitted when the caller cannot edit the relation; the row then has no detach control. */
  onUnlink?: () => void
  unlinkLabel?: string

  /** The related record's fields, revealed on expand. Omit for a row with nothing more to show. */
  children?: ReactNode
}) => (
  <li>
    <Collapsible className='group/related bg-muted/50 rounded-md'>
      <div className='flex min-h-9 items-center gap-1.5 px-2 py-1.5'>
        {children ? (
          <CollapsibleTrigger
            render={
              <Button
                variant='ghost'
                size='icon-sm'
                aria-label={`Show ${label} details`}
                className='text-muted-foreground hover:text-foreground -ml-1 size-5 shrink-0'
              />
            }
          >
            <ChevronDownIcon className='size-3.5 transition-transform group-data-open/related:rotate-180' />
          </CollapsibleTrigger>
        ) : null}

        {icon}

        {href ? (
          <Link href={href} className='min-w-0 flex-1 truncate text-sm hover:underline' title={label}>
            {label}
          </Link>
        ) : (
          <span className='min-w-0 flex-1 truncate text-sm' title={label}>
            {label}
          </span>
        )}

        {meta ? <span className='flex shrink-0 items-center gap-1.5'>{meta}</span> : null}

        {onUnlink ? (
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label={unlinkLabel ?? `Unlink ${label}`}
            onClick={onUnlink}
            className='text-muted-foreground hover:text-destructive size-5 shrink-0'
          >
            <XIcon />
          </Button>
        ) : null}
      </div>

      {children ? (
        <CollapsibleContent>
          <div className='space-y-0.5 border-t px-2 py-2'>{children}</div>
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  </li>
)
