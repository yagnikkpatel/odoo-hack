'use client'

// React Imports
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'

// Third-party Imports
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { Table } from '@tanstack/react-table'
import {
  addMonths,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
import {
  parseAsString,
  useQueryState,
} from '@/features/nexacrm/adapters/query-state'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/features/nexacrm/components/ui/dropdown-menu'

import CalendarChip from '@/features/nexacrm/components/calendar/calendar-chip'

import SearchableMenuSection from '@/features/nexacrm/components/ui/searchable-menu-section'

// Hook Imports
import { useMediaQuery } from '@/features/nexacrm/hooks/use-media-query'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { companyDateTime } from './types'

/*
 * ! ROW MODELS: any renderer without its own pager must use `getPrePaginationRowModel()`. The other
 * ! two fail silently, in opposite directions:
 * !   • `getRowModel()` is PAGINATED - shows page 1 only, and records past it become unreachable
 * !     while the view bar still counts them.
 * !   • `getFilteredRowModel()` is PRE-SORT - TanStack's pipeline is filtered → grouped → sorted →
 * !     expanded → paginated, so it silently drops the user's sort.
 *
 * The attendance directory loads all pages for the visible grid range.
 *
 * ! A record whose date field is unset is HIDDEN, and there is deliberately no "Unscheduled" tray.
 *
 * Month layout only - no day or week view.
 */
// Attendance adaptation of the NexaCRM calendar: compact chips also open records.
export type RecordCalendarProps<TData> = {
  onOpenRecord: (record: TData) => void
  table: Table<TData>
  loading?: boolean

  /** Stable id, as on the board - used for React keys and as the drag id. */
  getId: (record: TData) => string

  getDate: (record: TData) => string | undefined

  /** The module's own card - the SAME component its board uses. */
  renderCard: (record: TData) => ReactNode

  getTitle: (record: TData) => string

  /** One short field beside the title on the chip - an amount, a due time, a company. Optional. */
  getMeta?: (record: TData) => string | undefined

  isUntitled?: (record: TData) => boolean

  onDateChange?: (record: TData, iso: string) => void

  /** RBAC gate. Drag is offered only when this is true AND `onDateChange` is supplied. */
  canEdit?: boolean

  /** Test hook, so a spec can target one module's calendar unambiguously. */
  testId?: string
}

const MONTH_PARAM_FORMAT = 'yyyy-MM'
const companyToday = () => new Date(companyDateTime().slice(0, 10) + 'T12:00:00')

/** How far the month dropdown reaches either side of today. */
const MONTH_PICKER_RANGE = 12

const VISIBLE_RECORDS_PER_DAY = 5

/** Local-time `YYYY-MM-DD`, the droppable id for a day and the key records are bucketed under. */
const dayKey = (date: Date) => format(date, 'yyyy-MM-dd')

const withDateOf = (iso: string | undefined, day: Date): string => {
  const next = new Date(day)
  const original = iso ? new Date(iso) : undefined

  next.setHours(original?.getHours() ?? 9, original?.getMinutes() ?? 0, 0, 0)

  return next.toISOString()
}

const DayCell = <TData,>({
  day,
  month,
  records,
  isDropTarget,
  getId,
  renderCard,
  draggable,
}: {
  day: Date
  month: Date
  records: TData[]
  isDropTarget: boolean
  getId: (record: TData) => string
  renderCard: (record: TData) => ReactNode
  draggable: boolean
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: dayKey(day),
    disabled: !isDropTarget,
  })
  const [page, setPage] = useState(0)

  const isToday = isSameDay(day, companyToday())

  const pageCount = Math.max(1, Math.ceil(records.length / VISIBLE_RECORDS_PER_DAY))
  // Records can shrink (a filter, a drag-and-drop move) without this cell
  // remounting, so the stored page can point past the new last page.
  const currentPage = Math.min(page, pageCount - 1)
  const shown = records.slice(
    currentPage * VISIBLE_RECORDS_PER_DAY,
    (currentPage + 1) * VISIBLE_RECORDS_PER_DAY,
  )

  return (
    <div
      ref={setNodeRef}
      data-testid={`calendar-day-${dayKey(day)}`}
      className={cn(
        'flex min-h-28 min-w-0 flex-col gap-1.5 border-r p-1.5 last:border-r-0',

        !isSameMonth(day, month) && 'bg-muted/25',
        isOver && 'bg-brand/5 ring-brand/30 ring-1 ring-inset',
      )}
    >
      <span
        className={cn(
          'text-muted-foreground self-end px-1 text-xs tabular-nums',
          isToday &&
            'bg-brand text-brand-foreground rounded px-1.5 font-medium',
        )}
      >
        {format(day, 'd')}
      </span>

      {shown.map((record) => (
        <CalendarCard
          key={getId(record)}
          id={getId(record)}
          draggable={draggable}
        >
          {renderCard(record)}
        </CalendarCard>
      ))}

      {pageCount > 1 && (
        <div className="mt-auto flex items-center justify-between gap-1 pt-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-5"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            aria-label={`Previous entries for ${format(day, 'd MMMM')}`}
          >
            <ChevronLeftIcon className="size-3" />
          </Button>
          <span className="text-muted-foreground text-[10px] tabular-nums">
            {currentPage + 1}/{pageCount}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-5"
            disabled={currentPage === pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
            aria-label={`Next entries for ${format(day, 'd MMMM')}`}
          >
            <ChevronRightIcon className="size-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

const CalendarCard = ({
  id,
  draggable,
  children,
}: {
  id: string
  draggable: boolean
  children: ReactNode
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    disabled: !draggable,
  })

  if (!draggable) return <div className="min-w-0">{children}</div>

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn('min-w-0 cursor-grab', isDragging && 'opacity-40')}
    >
      {children}
    </div>
  )
}

const GRID_QUERY = '(min-width: 1024px)'

const FULL_CARD_QUERY = '(min-width: 1280px)'

const CalendarAgenda = <TData,>({
  days,
  getId,
  renderCard,
  testId,
}: {
  days: { day: Date; records: TData[] }[]
  getId: (record: TData) => string
  renderCard: (record: TData) => ReactNode
  testId: string
}) => {
  if (days.length === 0) {
    return (
      <div
        data-testid={testId}
        className="text-muted-foreground rounded-md border px-4 py-10 text-center text-sm"
      >
        No attendance entries this month.
      </div>
    )
  }

  return (
    <div data-testid={testId} className="flex flex-col gap-4">
      {days.map(({ day, records }) => (
        <div key={day.toISOString()} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-2 border-b pb-1.5">
            <span
              className={cn(
                'text-sm font-medium tabular-nums',
                isSameDay(day, new Date()) &&
                  'bg-brand text-brand-foreground rounded px-1.5',
              )}
            >
              {format(day, 'd')}
            </span>
            <span className="text-muted-foreground text-xs">
              {format(day, 'EEEE')}
            </span>
            <span className="text-muted-foreground/70 ml-auto text-xs tabular-nums">
              {records.length}
            </span>
          </div>

          <div className="grid items-start gap-2 sm:grid-cols-2">
            {records.map((record) => (
              <div key={getId(record)} className="min-w-0">
                {renderCard(record)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const RecordCalendar = <TData,>({
  table,
  onOpenRecord,
  getId,
  getDate,
  renderCard,
  getTitle,
  getMeta,
  isUntitled,
  onDateChange,
  canEdit = false,
  testId = 'record-calendar',
  loading = false,
}: RecordCalendarProps<TData>) => {
  const isGrid = useMediaQuery(GRID_QUERY)
  const showsFullCard = useMediaQuery(FULL_CARD_QUERY)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const [monthParam, setMonthParam] = useQueryState(
    'month',
    parseAsString
      .withDefault('')
      .withOptions({ history: 'push', shallow: true, clearOnDefault: true }),
  )

  const month = useMemo(() => {
    if (!monthParam) return startOfMonth(companyToday())

    const parsed = parse(monthParam, MONTH_PARAM_FORMAT, new Date())

    return Number.isNaN(parsed.getTime())
      ? startOfMonth(companyToday())
      : startOfMonth(parsed)
  }, [monthParam])

  const rows = table.getPrePaginationRowModel().rows

  const isDraggable = canEdit && Boolean(onDateChange) && isGrid

  const renderCellCard = (record: TData): ReactNode =>
    showsFullCard ? (
      renderCard(record)
    ) : (
      <button
        type="button"
        className="w-full min-w-0 rounded text-left focus-visible:ring-2 focus-visible:ring-primary"
        onClick={() => onOpenRecord(record)}
        aria-label={'View attendance for ' + getTitle(record)}
      >
        <CalendarChip
          title={getTitle(record)}
          meta={getMeta?.(record)}
          muted={isUntitled?.(record)}
        />
      </button>
    )

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })

    return eachWeekOfInterval({ start, end }, { weekStartsOn: 1 }).map(
      (weekStart) =>
        eachDayOfInterval({
          start: weekStart,
          end: endOfWeek(weekStart, { weekStartsOn: 1 }),
        }),
    )
  }, [month])

  const byDay = useMemo(() => {
    const buckets = new Map<string, TData[]>()

    rows.forEach((row) => {
      const iso = getDate(row.original)

      if (!iso) return

      const date = new Date(iso)

      if (Number.isNaN(date.getTime())) return

      const key = dayKey(date)

      buckets.set(key, [...(buckets.get(key) ?? []), row.original])
    })

    return buckets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  const agendaDays = useMemo(
    () =>
      eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
        .map((day) => ({ day, records: byDay.get(dayKey(day)) ?? [] }))
        .filter((entry) => entry.records.length > 0),
    [month, byDay],
  )

  const draggingRecord = draggingId
    ? rows.find((row) => getId(row.original) === draggingId)?.original
    : undefined

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setDraggingId(null)

    if (!over || !onDateChange) return

    const record = rows.find(
      (row) => getId(row.original) === active.id,
    )?.original

    if (!record) return

    const day = parse(String(over.id), 'yyyy-MM-dd', new Date())

    if (Number.isNaN(day.getTime())) return

    if (dayKey(day) === dayKey(new Date(getDate(record) ?? ''))) return

    onDateChange(record, withDateOf(getDate(record), day))
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const monthOptions = useMemo(() => {
    const base = startOfMonth(companyToday())

    return Array.from({ length: MONTH_PICKER_RANGE * 2 + 1 }, (_, index) =>
      addMonths(base, index - MONTH_PICKER_RANGE),
    )
  }, [])

  const goToMonth = (next: Date) => {
    const start = startOfMonth(next)

    setMonthParam(
      isSameMonth(start, companyToday()) ? '' : format(start, MONTH_PARAM_FORMAT),
    )
  }

  const monthGrid = (
    <div>
      <div className="grid grid-cols-7">
        {weeks[0]?.map((day) => (
          <div
            key={day.toISOString()}
            className="text-muted-foreground px-2 pb-1.5 text-right text-xs"
          >
            {format(day, 'EEE')}
          </div>
        ))}
      </div>

      <div data-testid={testId} className="overflow-hidden rounded-md border">
        {weeks.map((week) => (
          <div
            key={week[0].toISOString()}
            className="grid grid-cols-7 border-b last:border-b-0"
          >
            {week.map((day) => (
              <DayCell
                key={day.toISOString()}
                day={day}
                month={month}
                records={byDay.get(dayKey(day)) ?? []}
                isDropTarget={isDraggable}
                getId={getId}
                renderCard={renderCellCard}
                draggable={isDraggable}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )

  const monthNav = (
    <div className="flex items-center justify-between gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 font-medium"
            />
          }
        >
          {format(month, 'MMMM yyyy')}
          <ChevronDownIcon className="text-muted-foreground size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-80 w-48 overflow-y-auto"
        >
          <DropdownMenuGroup>
            <SearchableMenuSection items={monthOptions} getLabel={option => format(option, 'MMMM yyyy')} label='months'>
            {options => options.map((option) => (
              <DropdownMenuItem
                key={format(option, MONTH_PARAM_FORMAT)}
                onClick={() => goToMonth(option)}
                className={isSameMonth(option, month) ? 'bg-muted' : ''}
              >
                {format(option, 'MMMM yyyy')}
              </DropdownMenuItem>
            ))}
            </SearchableMenuSection>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => goToMonth(addMonths(month, -1))}
        >
          <ChevronLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => goToMonth(companyToday())}
        >
          Today
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next month"
          onClick={() => goToMonth(addMonths(month, 1))}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )

  const body = (
    <div className="flex flex-col gap-3">
      {monthNav}

      {loading ? <p role="status" className="text-muted-foreground rounded-lg border px-4 py-10 text-center text-sm">Loading attendance for this month…</p> : isGrid ? (
        monthGrid
      ) : (
        <CalendarAgenda
          days={agendaDays}
          getId={getId}
          renderCard={renderCard}
          testId={testId}
        />
      )}

      {/* Repeats the month controls below the grid so switching months never requires scrolling back up. */}
      <div className="border-t pt-3">{monthNav}</div>
    </div>
  )

  if (!isDraggable) return body

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={({ active }: DragStartEvent) =>
        setDraggingId(String(active.id))
      }
      onDragCancel={() => setDraggingId(null)}
      onDragEnd={handleDragEnd}
    >
      {body}

      <DragOverlay>
        {draggingRecord ? (
          <div
            data-testid="calendar-drag-overlay"
            className="pointer-events-none w-64 rotate-1 shadow-xl"
          >
            {renderCard(draggingRecord)}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export default RecordCalendar
