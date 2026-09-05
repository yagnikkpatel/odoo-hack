'use client'

// React Imports
import type { ReactNode } from 'react'

// Third-party Imports
import { parseAsStringLiteral, useQueryState } from '@/features/nexacrm/adapters/query-state'
import type { Column, Table } from '@tanstack/react-table'
import * as Icon from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownAZIcon,
  ArrowUpAZIcon,
  ListFilterIcon,
  ArrowUpDownIcon,
  PlusIcon,
  SearchIcon,
  XIcon
} from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import SearchableMenuSection from '@/features/nexacrm/components/ui/searchable-menu-section'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { RECORD_VIEW_META, RECORD_VIEW_TYPES } from '@/features/nexacrm/lib/view-preference'
import type { RecordViewType } from '@/features/nexacrm/lib/view-preference'

type RecordViewBarProps<TData> = {
  table: Table<TData>

  /** Saved-view name. Static for now - saved views are a later phase. */
  viewName: string

  /** Rows currently shown (tracks filters). */
  count: number
  icon?: LucideIcon
  searchPlaceholder?: string

  /** The page's primary action (e.g. "New company") - kept on the same line as the view name. */
  actions?: ReactNode

  /** The "Options" dropdown - fields, summary toggle, copy link, export. */
  options?: ReactNode

  viewType?: RecordViewType
  onViewTypeChange?: (next: RecordViewType) => void

  dynamicFilterOptions?: Record<string, { label: string; value: string }[]>

  viewTypes?: readonly RecordViewType[]
  showSort?: boolean
  showSearch?: boolean

  /** Hides each filter field's icon+label header, leaving just its options. Off by default. */
  showFilterFieldLabels?: boolean

  /** Hides the whole chips row below (active-filter chips, Add filter, Reset). On by default. */
  showFilterChips?: boolean
}

export const VIEW_BAR_TRIGGER = 'max-sm:border-border max-sm:size-6 max-sm:border'

export { RECORD_VIEW_TYPES } from '@/features/nexacrm/lib/view-preference'
export type { RecordViewType } from '@/features/nexacrm/lib/view-preference'

const VIEW_TYPE_ICONS = Object.fromEntries(
  RECORD_VIEW_TYPES.map(type => [type, Icon[RECORD_VIEW_META[type].icon]])
) as Record<RecordViewType, LucideIcon>

export const useRecordViewType = (defaultView: RecordViewType = 'table') =>
  useQueryState(
    'view',
    parseAsStringLiteral(RECORD_VIEW_TYPES).withDefault(defaultView).withOptions({ history: 'push', shallow: true })
  )

const STRUCTURAL_COLUMN_IDS = ['select', 'actions']

const isStructural = (id: string) => STRUCTURAL_COLUMN_IDS.includes(id)

const columnLabel = <TData,>(column: Column<TData, unknown>) => column.columnDef.meta?.label ?? column.id

const FieldIcon = <TData,>({ column }: { column: Column<TData, unknown> }) => {
  const Icon = column.columnDef.meta?.icon

  return Icon ? <Icon className='text-muted-foreground size-4 shrink-0' /> : null
}

const RecordViewBar = <TData,>({
  table,
  viewName,
  count,
  icon: ViewIcon,
  searchPlaceholder = 'Search…',
  actions,
  options,
  dynamicFilterOptions,
  viewTypes = ['table'],
  viewType = 'table',
  onViewTypeChange,
  showSort = true,
  showSearch = true,
  showFilterFieldLabels = true,
  showFilterChips = true
}: RecordViewBarProps<TData>) => {
  const optionsFor = (column: Column<TData, unknown>) =>
    dynamicFilterOptions?.[column.id] ?? column.columnDef.meta?.filterOptions ?? []

  const ActiveViewIcon = VIEW_TYPE_ICONS[viewType]

  const globalFilter = (table.getState().globalFilter as string) ?? ''
  const sorting = table.getState().sorting

  const allColumns = table.getAllLeafColumns().filter(column => !isStructural(column.id))

  const isTextFilter = (column: Column<TData, unknown>) => Boolean(column.columnDef.meta?.textFilter)
  const filterableColumns = allColumns.filter(column => optionsFor(column).length > 0 || isTextFilter(column))
  const sortableColumns = allColumns.filter(column => column.getCanSort())

  const visible = (columns: Column<TData, unknown>[]) => columns.filter(column => column.getIsVisible())
  const hidden = (columns: Column<TData, unknown>[]) => columns.filter(column => !column.getIsVisible())

  const activeFilters = allColumns
    .filter(column => column.getFilterValue() !== undefined)
    .map(column => {
      const value = String(column.getFilterValue())
      const option = optionsFor(column).find(item => item.value === value)

      return { column, label: columnLabel(column), value: option?.label ?? value }
    })

  const hasChips = activeFilters.length > 0 || sorting.length > 0
  const isDirty = hasChips || globalFilter.length > 0

  const resetAll = () => {
    table.setGlobalFilter('')
    table.resetColumnFilters()
    table.resetSorting()
  }

  const renderFilterField = (column: Column<TData, unknown>) => (
    <div key={column.id} className='border-border/60 border-b py-1.5 last:border-b-0'>
      {showFilterFieldLabels ? (
        <div className='text-muted-foreground flex items-center gap-1.5 px-1.5 py-1 text-xs font-medium'>
          <FieldIcon column={column} />
          {columnLabel(column)}
        </div>
      ) : null}
      {isTextFilter(column) ? (
        <div className='px-1.5 pb-0.5'>
          <Input
            value={(column.getFilterValue() as string) ?? ''}
            onChange={event => column.setFilterValue(event.target.value || undefined)}
            onKeyDown={event => event.stopPropagation()}
            placeholder={`${columnLabel(column)} contains…`}
            aria-label={`Filter by ${columnLabel(column)}`}
            className='input-sm w-full'
          />
        </div>
      ) : (
        <SearchableMenuSection
          items={optionsFor(column)}
          getLabel={option => option.label}
          label={columnLabel(column).toLowerCase()}
        >
          {options =>
            options.map(option => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={column.getFilterValue() === option.value}
                onCheckedChange={checked => column.setFilterValue(checked ? option.value : undefined)}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))
          }
        </SearchableMenuSection>
      )}
    </div>
  )

  const renderFieldGroup = (
    label: string,
    columns: Column<TData, unknown>[],
    render: (column: Column<TData, unknown>) => ReactNode
  ) =>
    columns.length > 0 ? (
      <DropdownMenuGroup>
        {label ? (
          <DropdownMenuLabel className='text-muted-foreground text-xs font-normal'>{label}</DropdownMenuLabel>
        ) : null}
        <SearchableMenuSection items={columns} getLabel={columnLabel} label={label.toLowerCase()}>
          {options => options.map(render)}
        </SearchableMenuSection>
      </DropdownMenuGroup>
    ) : null

  return (
    <div data-testid='record-view-bar' className='bg-background sticky top-0 z-30 -mx-4'>
      <div className='flex h-11 shrink-0 items-center gap-2 border-b px-4'>
        <div className='flex min-w-0 items-center gap-2'>
          {ViewIcon ? <ViewIcon className='text-muted-foreground size-4 shrink-0' /> : null}
          <span className='truncate text-sm font-medium'>{viewName}</span>
          <span data-testid='record-count' className='text-muted-foreground shrink-0 text-sm tabular-nums'>
            · {count}
          </span>
        </div>

        <div className='ml-auto flex shrink-0 items-center gap-1'>
          {viewTypes.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant='ghost' size='sm' className={VIEW_BAR_TRIGGER} />}>
                <ActiveViewIcon /> <span className='max-sm:hidden'>{RECORD_VIEW_META[viewType].label}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-40'>
                <DropdownMenuGroup>
                  {viewTypes.map(type => {
                    const TypeIcon = VIEW_TYPE_ICONS[type]

                    return (
                      <DropdownMenuItem
                        key={type}
                        onClick={() => onViewTypeChange?.(type)}
                        className={type === viewType ? 'bg-muted' : ''}
                      >
                        <TypeIcon /> {RECORD_VIEW_META[type].label}
                      </DropdownMenuItem>
                    )
                  })}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant='ghost' size='sm' className={VIEW_BAR_TRIGGER} />}>
              <ListFilterIcon /> <span className='max-sm:hidden'>Filter</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-60'>
              {showSearch && <div className='relative p-1'>
                <SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2' />
                <Input
                  value={globalFilter}
                  onChange={event => table.setGlobalFilter(event.target.value)}
                  onKeyDown={event => event.stopPropagation()}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className='input-sm pl-8'
                />
              </div>}
              {showSearch && <DropdownMenuSeparator />}
              {renderFieldGroup('Visible fields', visible(filterableColumns), renderFilterField)}
              {renderFieldGroup('', hidden(filterableColumns), renderFilterField)}
            </DropdownMenuContent>
          </DropdownMenu>

          {showSort && <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant='ghost' size='sm' className={VIEW_BAR_TRIGGER} />}>
              <ArrowUpDownIcon /> <span className='max-sm:hidden'>Sort</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-60'>
              {renderFieldGroup('Fields', sortableColumns, column => (
                <DropdownMenuSub key={column.id}>
                  <DropdownMenuSubTrigger>
                    <FieldIcon column={column} />
                    {columnLabel(column)}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onClick={() => table.setSorting([{ id: column.id, desc: false }])}>
                      <ArrowUpAZIcon /> Ascending
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => table.setSorting([{ id: column.id, desc: true }])}>
                      <ArrowDownAZIcon /> Descending
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>}

          {options ?? null}
          {actions ? <div className='ml-1 flex items-center gap-2'>{actions}</div> : null}
        </div>
      </div>

      {hasChips && showFilterChips ? (
        <div className='flex min-h-11 shrink-0 flex-wrap items-center gap-2 border-b px-4 py-1.5 sm:px-6'>
          {sorting.map(sort => {
            const column = table.getColumn(sort.id)

            return (
              <Chip
                key={`sort-${sort.id}`}
                icon={sort.desc ? ArrowDownAZIcon : ArrowUpAZIcon}
                label={column ? columnLabel(column) : sort.id}
                onRemove={() => table.setSorting(sorting.filter(item => item.id !== sort.id))}
              />
            )
          })}

          {activeFilters.map(({ column, label, value }) => (
            <Chip
              key={`filter-${column.id}`}
              icon={column.columnDef.meta?.icon}
              label={`${label}: ${value}`}
              onRemove={() => column.setFilterValue(undefined)}
            />
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant='ghost' size='sm' className='text-muted-foreground h-7 px-2' />}
            >
              <PlusIcon /> Add filter
            </DropdownMenuTrigger>
            <DropdownMenuContent align='start' className='w-60'>
              {renderFieldGroup('Fields', filterableColumns, renderFilterField)}
            </DropdownMenuContent>
          </DropdownMenu>

          {isDirty ? (
            <Button variant='ghost' size='sm' className='ml-auto h-7 px-2' onClick={resetAll}>
              Reset
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const Chip = ({ icon: Icon, label, onRemove }: { icon?: LucideIcon; label: string; onRemove: () => void }) => (
  <span
    className={cn(
      'bg-muted/60 text-foreground flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium'
    )}
  >
    {Icon ? <Icon className='text-muted-foreground size-3.5 shrink-0' /> : null}
    <span className='max-w-48 truncate'>{label}</span>
    <Button
      variant='ghost'
      size='icon-sm'
      aria-label={`Remove ${label}`}
      onClick={onRemove}
      className='text-muted-foreground hover:text-foreground -mr-1 size-5'
    >
      <XIcon className='size-3.5' />
    </Button>
  </span>
)

export default RecordViewBar
