'use client'

// React Imports
import { useMemo, useState } from 'react'
import type { ComponentType } from 'react'

// Third-party Imports
import { format } from 'date-fns'
import * as Icon from 'lucide-react'

// Type Imports
import type { ActivityFilter } from '@/features/nexacrm/types/apps/activity-types'
import {
  ACTIVITY_FILTER_LABELS,
  ACTIVITY_FILTERS,
  ACTIVITY_TYPE_META,
  matchesActivityFilter
} from '@/features/nexacrm/types/apps/activity-types'
import type { ParentEntityType } from '@/features/nexacrm/types/apps/record-ref'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/features/nexacrm/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import { RecordHeading } from '@/features/nexacrm/components/record/record-section'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import type { FeedEntry } from '@/features/nexacrm/store/use-record-feed'
import { useRecordFeed } from '@/features/nexacrm/store/use-record-feed'
import { useUser } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { formatActivityTime } from '@/features/nexacrm/utils/activity-utils'

const Entry = ({ entry, isLast, onOpenNote }: { entry: FeedEntry; isLast: boolean; onOpenNote?: () => void }) => {
  const actor = useUser(entry.actorId)
  const { user } = useCurrentUser()
  const Tag = Icon[ACTIVITY_TYPE_META[entry.type].icon] as ComponentType<{ className?: string }>

  const changes = entry.changes?.length ? entry.changes : undefined

  const line = (
    <>
      <span className='font-medium'>{entry.actorId === user.id ? 'You' : (actor?.name ?? 'System')}</span>{' '}
      <span className='text-muted-foreground'>{entry.verb}</span> <span className='font-medium'>{entry.subject}</span>
    </>
  )

  return (
    <li className='flex gap-3'>
      <div className='flex flex-col items-center'>
        <span
          className='bg-background text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border'
          aria-hidden
        >
          <Tag className='size-3' />
        </span>
        {!isLast ? <span className='bg-border my-1 w-px flex-1' /> : null}
      </div>

      <div className={cn('min-w-0 flex-1', isLast ? 'pb-1' : 'pb-4')}>
        <div className='flex items-start justify-between gap-3'>
          {onOpenNote ? (
            <Button
              variant='ghost'
              onClick={onOpenNote}
              className='-mx-2 h-auto min-w-0 shrink justify-start px-2 py-0.5 text-left text-sm font-normal whitespace-normal hover:bg-transparent'
            >
              <span className='min-w-0'>{line}</span>
            </Button>
          ) : changes ? (
            <Collapsible className='group/changes min-w-0 flex-1'>
              <CollapsibleTrigger
                render={
                  <Button
                    variant='ghost'
                    className='-mx-2 h-auto w-[calc(100%+1rem)] justify-start gap-1 px-2 py-0.5 text-left text-sm font-normal whitespace-normal hover:bg-transparent aria-expanded:bg-transparent'
                  />
                }
              >
                <span className='min-w-0'>{line}</span>
                <Icon.ChevronDownIcon className='text-muted-foreground size-3.5 shrink-0 transition-transform group-data-open/changes:rotate-180' />
              </CollapsibleTrigger>

              <CollapsibleContent>
                <ul data-testid='field-changes' className='bg-muted/40 mt-2 space-y-1.5 rounded-lg border p-3'>
                  {changes.map(change => (
                    <li key={change.label} className='text-muted-foreground flex items-center gap-1.5 text-sm'>
                      <Icon.PencilIcon className='size-3 shrink-0' />
                      <span className='shrink-0'>{change.label}</span>
                      <Icon.ArrowRightIcon className='size-3 shrink-0' />
                      {change.value ? <span className='text-foreground min-w-0 truncate'>{change.value}</span> : null}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </Collapsible>
          ) : (
            <p className='min-w-0 text-sm'>{line}</p>
          )}

          <time dateTime={entry.at} className='text-muted-foreground shrink-0 text-xs whitespace-nowrap'>
            {formatActivityTime(entry.at)}
          </time>
        </div>

        {entry.body ? (
          <p className='text-muted-foreground mt-1 line-clamp-2 text-sm text-pretty'>{entry.body}</p>
        ) : null}
      </div>
    </li>
  )
}

const TimelinePanel = ({
  entityType,
  entityId,
  onOpenNote
}: {
  entityType: ParentEntityType
  entityId: string

  /** Opens a note in the record's sheet. Omitted where notes have no detail surface. */
  onOpenNote?: (noteId: string) => void
}) => {
  const [filter, setFilter] = useState<ActivityFilter>('everything')
  const feed = useRecordFeed(entityType, entityId)

  const groups = useMemo(() => {
    const visible = feed.filter(entry => matchesActivityFilter(entry.type, filter))
    const byMonth: { key: string; label: string; items: FeedEntry[] }[] = []

    for (const entry of visible) {
      const date = new Date(entry.at)
      const key = format(date, 'yyyy-MM')
      const last = byMonth.at(-1)

      if (last?.key === key) last.items.push(entry)
      else byMonth.push({ key, label: format(date, 'MMMM yyyy'), items: [entry] })
    }

    return byMonth
  }, [feed, filter])

  const total = groups.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <RecordHeading title='Timeline' count={total} />

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant='outline' size='sm' />}>
            <Icon.ListFilterIcon />
            {ACTIVITY_FILTER_LABELS[filter]}
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-48'>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={filter} onValueChange={value => setFilter(value as ActivityFilter)}>
                {ACTIVITY_FILTERS.map(option => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {ACTIVITY_FILTER_LABELS[option]}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {groups.length > 0 ? (
        <div className='space-y-4'>
          {groups.map(group => (
            <section key={group.key} aria-label={group.label}>
              <div className='flex items-center gap-3 pb-4'>
                <h3 className='text-muted-foreground shrink-0 text-xs'>{group.label}</h3>
                <span className='bg-border h-px flex-1' />
              </div>

              <ul>
                {group.items.map((entry, index) => (
                  <Entry
                    key={entry.id}
                    entry={entry}
                    isLast={index === group.items.length - 1}
                    onOpenNote={entry.noteId && onOpenNote ? () => onOpenNote(entry.noteId as string) : undefined}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <DataTableEmptyState
          icon={Icon.ClockIcon}
          title='Nothing here yet'
          description={
            filter === 'everything'
              ? 'Calls, meetings, emails and notes on this record will appear here.'
              : `No ${ACTIVITY_FILTER_LABELS[filter].toLowerCase()} on this record yet.`
          }
        />
      )}
    </div>
  )
}

export default TimelinePanel
