'use client'
import {
  ClockIcon,
  ChevronDownIcon,
  PencilIcon,
  ArrowRightIcon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/features/nexacrm/components/ui/collapsible'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import { RecordHeading } from '@/features/nexacrm/components/record/record-section'
import UserChip from '@/features/nexacrm/components/record/user-chip'
import { formatActivityTime } from '@/features/nexacrm/utils/activity-utils'
import { useEmployeesStore } from '../store'
import { cn } from '@/features/nexacrm/lib/utils'

/** NexaCRM timeline presentation, backed only by employee edits—not CRM emails or deals. */
export default function EmployeeTimeline({
  employeeId,
}: {
  employeeId: string
}) {
  const activities = useEmployeesStore((state) => state.activities)
  const entries = activities.filter(
    (activity) => activity.employeeId === employeeId,
  )
  return (
    <div className="space-y-4">
      <RecordHeading title="Timeline" count={entries.length} />
      {!entries.length ? (
        <DataTableEmptyState
          icon={ClockIcon}
          title="No employee changes yet"
          description="Changes to this employee will appear here. Contract history will be connected with the Contracts module."
        />
      ) : (
        <ul>
          {entries.map((entry, index) => (
            <li key={entry.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className="bg-background text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border"
                  aria-hidden
                >
                  <PencilIcon className="size-3" />
                </span>
                {index < entries.length - 1 && (
                  <span className="bg-border my-1 w-px flex-1" />
                )}
              </div>
              <div
                className={cn(
                  'min-w-0 flex-1',
                  index === entries.length - 1 ? 'pb-1' : 'pb-4',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <Collapsible className="group/changes min-w-0 flex-1">
                    <CollapsibleTrigger
                      disabled={!entry.changes?.length}
                      render={
                        <Button
                          variant="ghost"
                          className="-mx-2 h-auto w-[calc(100%+1rem)] justify-start gap-1 px-2 py-0.5 text-left text-sm font-normal whitespace-normal hover:bg-transparent aria-expanded:bg-transparent disabled:opacity-100"
                        />
                      }
                    >
                      <span className="min-w-0">
                        <UserChip userId={entry.actorId} />{' '}
                        <span className="text-muted-foreground">
                          {entry.verb}
                        </span>{' '}
                        <span className="font-medium">{entry.subject}</span>
                      </span>
                      {entry.changes?.length ? (
                        <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0 group-data-open/changes:rotate-180" />
                      ) : null}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <ul className="bg-muted/40 mt-2 space-y-1.5 rounded-lg border p-3">
                        {entry.changes?.map((change) => (
                          <li
                            key={change.label}
                            className="text-muted-foreground flex items-center gap-1.5 text-sm"
                          >
                            <PencilIcon className="size-3 shrink-0" />
                            <span>{change.label}</span>
                            <ArrowRightIcon className="size-3 shrink-0" />
                            <span className="text-foreground min-w-0 truncate">
                              {change.value || 'Cleared'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CollapsibleContent>
                  </Collapsible>
                  <time
                    dateTime={entry.at}
                    className="text-muted-foreground shrink-0 text-xs whitespace-nowrap"
                  >
                    {formatActivityTime(entry.at)}
                  </time>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
