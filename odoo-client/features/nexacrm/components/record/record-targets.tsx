'use client'

// React Imports
import { useMemo, useState } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { PlusIcon } from 'lucide-react'

// Type Imports
import type { RecordRef } from '@/features/nexacrm/types/apps/record-ref'
import { refKey } from '@/features/nexacrm/types/apps/record-target'
import type { ResolvedRecord } from '@/features/nexacrm/types/apps/resolved-record'
import { resolvedRecordHref, resolvedRecordLabel } from '@/features/nexacrm/types/apps/resolved-record'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/features/nexacrm/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/features/nexacrm/components/ui/popover'
import RecordIcon from '@/features/nexacrm/components/record/record-icon'

// Store Imports
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'
import { useResolvedRecords } from '@/features/nexacrm/store/use-resolved-records'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

/** The id of a resolved record, whichever branch of the union it is. */
const recordId = (record: ResolvedRecord): string => {
  if (record.entityType === 'company') return record.company.id
  if (record.entityType === 'person') return record.person.id
  if (record.entityType === 'task') return record.task.id
  if (record.entityType === 'note') return record.note.id

  return record.opportunity.id
}

/** A record chip. A link where the record has a page, plain text where it does not. */
const RecordChip = ({ record, className }: { record: ResolvedRecord; className?: string }) => {
  const label = resolvedRecordLabel(record)
  const href = resolvedRecordHref(record)

  const content = (
    <>
      <RecordIcon record={record} className='size-3.5! shrink-0' />
      <span className='truncate'>{label}</span>
    </>
  )

  const shell = cn(
    'bg-muted/70 flex h-5 max-w-full min-w-0 items-center gap-1 rounded px-1 text-xs font-medium',
    className
  )

  return href ? (
    <Link href={href} className={cn(shell, 'hover:bg-muted transition-colors')} onClick={e => e.stopPropagation()}>
      {content}
    </Link>
  ) : (
    <span className={shell}>{content}</span>
  )
}

export const RecordTargetChips = ({
  refs,
  max,
  empty = '-',
  inline
}: {
  refs: RecordRef[]
  max?: number
  empty?: string

  inline?: boolean
}) => {
  const records = useResolvedRecords(refs)

  if (records.length === 0) return <span className='text-muted-foreground'>{empty}</span>

  const shown = max ? records.slice(0, max) : records
  const overflow = records.length - shown.length

  return (
    <div className={cn('flex min-w-0 items-center gap-1', max ? 'overflow-hidden' : 'flex-wrap', inline && 'contents')}>
      {shown.map(record => (
        <RecordChip key={`${record.entityType}:${recordId(record)}`} record={record} />
      ))}
      {overflow > 0 ? <span className='text-muted-foreground shrink-0 text-xs'>+{overflow}</span> : null}
    </div>
  )
}

type PickerOption = {
  ref: RecordRef
  key: string
  label: string
  group: string
  search: string
  record: ResolvedRecord
}

const useTargetOptions = (): PickerOption[] => {
  const companies = useCompaniesStore(state => state.companies)
  const people = usePeopleStore(state => state.people)
  const opportunities = useOpportunitiesStore(state => state.opportunities)

  return useMemo(() => {
    const build = (ref: RecordRef, label: string, group: string, record: ResolvedRecord): PickerOption => ({
      ref,
      key: refKey(ref),
      label,
      group,
      record,

      search: `${label} ${group}`.toLowerCase()
    })

    return [
      ...companies.map(company =>
        build({ entityType: 'company', entityId: company.id }, company.name.trim() || 'Untitled', 'Companies', {
          entityType: 'company',
          company
        })
      ),
      ...people.map(person =>
        build(
          { entityType: 'person', entityId: person.id },
          `${person.firstName} ${person.lastName}`.trim() || 'Untitled',
          'People',
          { entityType: 'person', person }
        )
      ),
      ...opportunities.map(opportunity =>
        build(
          { entityType: 'opportunity', entityId: opportunity.id },
          opportunity.name.trim() || 'Untitled',
          'Opportunities',
          { entityType: 'opportunity', opportunity }
        )
      )
    ]
  }, [companies, people, opportunities])
}

const GROUP_ORDER = ['Companies', 'People', 'Opportunities']

export const RecordTargetsField = ({
  refs,
  onChange,
  canEdit,
  addLabel = 'Link a record'
}: {
  refs: RecordRef[]
  onChange: (next: RecordRef[]) => void
  canEdit: boolean
  addLabel?: string
}) => {
  const [open, setOpen] = useState(false)
  const options = useTargetOptions()

  const selected = useMemo(() => new Set(refs.map(refKey)), [refs])

  const toggle = (option: PickerOption) =>
    onChange(selected.has(option.key) ? refs.filter(ref => refKey(ref) !== option.key) : [...refs, option.ref])

  if (!canEdit) return <RecordTargetChips refs={refs} empty='No linked records' />

  return (
    <div className='flex min-w-0 flex-wrap items-center gap-1'>
      <RecordTargetChips refs={refs} empty='' inline />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant='ghost'
              size='sm'
              aria-label={addLabel}
              className='text-muted-foreground h-5 gap-1 px-1 text-xs font-normal'
            />
          }
        >
          <PlusIcon className='size-3.5' />
          {refs.length === 0 ? addLabel : null}
        </PopoverTrigger>
        <PopoverContent align='start' className='w-72 p-0'>
          <Command>
            <CommandInput placeholder='Search records…' />
            <CommandList>
              <CommandEmpty>No records found.</CommandEmpty>
              {GROUP_ORDER.map(group => {
                const groupOptions = options.filter(option => option.group === group)

                if (groupOptions.length === 0) return null

                return (
                  <CommandGroup key={group} heading={group}>
                    {groupOptions.map(option => (
                      <CommandItem
                        key={option.key}
                        value={option.search}
                        data-checked={selected.has(option.key) || undefined}
                        onSelect={() => toggle(option)}
                      >
                        <RecordIcon record={option.record} className='size-3.5!' />
                        <span className='truncate'>{option.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )
              })}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
