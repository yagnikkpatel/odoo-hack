'use client'

// React Imports
import { useId } from 'react'
import type { ReactNode } from 'react'

// Third-party Imports
import type { Column, Table } from '@tanstack/react-table'
import { SearchIcon, XIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import SearchableSelect from '@/features/nexacrm/components/ui/searchable-select'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

type FilterOption = { label: string; value: string }

type TableFilterBarProps<TData> = {
  table: Table<TData>

  /** Runtime options for columns whose choices are not known at column-def time. */
  dynamicFilterOptions?: Record<string, FilterOption[]>

  /** Page-specific filters (scope pickers, date ranges) rendered before the column filters. */
  children?: ReactNode

  /** Adds the table's global-filter search box. Off by default. */
  showSearch?: boolean
  searchPlaceholder?: string

  /** Hides the filters derived from column defs, leaving only `children`. On by default. */
  showColumnFilters?: boolean

  /** Hides the built-in "Clear filters" button, for pages that supply their own reset. On by default. */
  showClear?: boolean

  /** Trailing content pushed to the end of the row (e.g. an export button). */
  actions?: ReactNode

  className?: string
}

const STRUCTURAL_COLUMN_IDS = ['select', 'actions']

const ALL_VALUE = '__all__'

const columnLabel = <TData,>(column: Column<TData, unknown>) => column.columnDef.meta?.label ?? column.id

/** "Status" -> "All statuses". Good enough for the field labels we ship. */
const allOptionLabel = (label: string) => {
  const noun = label.toLowerCase()
  if (/(s|x|z|ch|sh)$/.test(noun)) return `All ${noun}es`
  if (/[^aeiou]y$/.test(noun)) return `All ${noun.slice(0, -1)}ies`
  return `All ${noun}s`
}

const Field = ({
  htmlFor,
  label,
  width = 'sm:w-52',
  children
}: {
  htmlFor: string
  label: string
  width?: string
  children: ReactNode
}) => (
  <div className={cn('grid w-full min-w-0 gap-1.5', width)}>
    <label htmlFor={htmlFor} className='text-muted-foreground text-xs'>
      {label}
    </label>
    {children}
  </div>
)

/**
 * The filter row that sits directly above a table. Replaces the old "Filter" dropdown in the view
 * bar: every filterable column gets a labelled control that shows its current value at a glance.
 */
const TableFilterBar = <TData,>({
  table,
  dynamicFilterOptions,
  children,
  showSearch = false,
  searchPlaceholder = 'Search…',
  showColumnFilters = true,
  showClear = true,
  actions,
  className
}: TableFilterBarProps<TData>) => {
  const uid = useId()

  const optionsFor = (column: Column<TData, unknown>) =>
    dynamicFilterOptions?.[column.id] ?? column.columnDef.meta?.filterOptions ?? []

  const isTextFilter = (column: Column<TData, unknown>) => Boolean(column.columnDef.meta?.textFilter)

  const filterableColumns = showColumnFilters
    ? table
        .getAllLeafColumns()
        .filter(column => !STRUCTURAL_COLUMN_IDS.includes(column.id) && column.getIsVisible())
        .filter(column => optionsFor(column).length > 0 || isTextFilter(column))
    : []

  const globalFilter = (table.getState().globalFilter as string) ?? ''
  const hasActiveFilters =
    globalFilter.length > 0 || table.getAllLeafColumns().some(column => column.getFilterValue() !== undefined)

  const clearFilters = () => {
    table.setGlobalFilter('')
    table.resetColumnFilters()
  }

  if (!children && !showSearch && !actions && filterableColumns.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      {children}

      {showSearch ? (
        <Field htmlFor={`${uid}-search`} label='Search'>
          <div className='relative'>
            <SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
            <Input
              id={`${uid}-search`}
              value={globalFilter}
              onChange={event => table.setGlobalFilter(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className='pl-8'
            />
          </div>
        </Field>
      ) : null}

      {filterableColumns.map(column => {
        const label = columnLabel(column)
        const fieldId = `${uid}-${column.id}`

        if (isTextFilter(column))
          return (
            <Field key={column.id} htmlFor={fieldId} label={label} width='sm:w-48'>
              <Input
                id={fieldId}
                value={(column.getFilterValue() as string) ?? ''}
                onChange={event => column.setFilterValue(event.target.value || undefined)}
                placeholder={`${label} contains…`}
                aria-label={`Filter by ${label}`}
              />
            </Field>
          )

        return (
          <Field key={column.id} htmlFor={fieldId} label={label}>
            <SearchableSelect
              id={fieldId}
              label={label}
              value={(column.getFilterValue() as string) ?? ALL_VALUE}
              options={[{ value: ALL_VALUE, label: allOptionLabel(label) }, ...optionsFor(column)]}
              onChange={value => column.setFilterValue(value === ALL_VALUE ? undefined : value)}
            />
          </Field>
        )
      })}

      {showClear && hasActiveFilters ? (
        <Button variant='ghost' size='sm' onClick={clearFilters}>
          <XIcon />
          Clear filters
        </Button>
      ) : null}

      {actions ? <div className='flex items-end gap-2 sm:ml-auto'>{actions}</div> : null}
    </div>
  )
}

export default TableFilterBar
