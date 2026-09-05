'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/features/nexacrm/components/ui/select'

// Hook Imports
import { usePagination } from '@/features/nexacrm/hooks/use-pagination'

// Util Imports
import { formatRecordCount } from '@/features/nexacrm/lib/record-count'

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50]
const PAGE_SIZE_ITEMS = PAGE_SIZE_OPTIONS.map(size => ({ label: `${size}`, value: `${size}` }))

type DataTablePaginationProps<TData> = {
  table: Table<TData>
  idPrefix?: string

  /** Singular record name for the footer count, e.g. "employee" -> "302 employees". */
  noun?: string

  /** Plural form, when adding an "s" is wrong ("person" -> "people"). */
  nounPlural?: string

  showSelectionCount?: boolean
}

const DataTablePagination = <TData,>({
  table,
  idPrefix = 'table',
  noun = 'row',
  nounPlural,
  showSelectionCount = true
}: DataTablePaginationProps<TData>) => {
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()
  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const totalCount = table.getFilteredRowModel().rows.length

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5
  })

  return (
    <div className='flex flex-col-reverse items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between'>
      <p className='text-muted-foreground text-sm'>
        {formatRecordCount(totalCount, noun, nounPlural)}
        {showSelectionCount && selectedCount > 0 ? ` · ${selectedCount} selected` : ''}
      </p>

      <div className='flex items-center gap-4 lg:gap-6'>
        <div className='flex items-center gap-2'>
          <p className='text-sm font-medium max-sm:hidden'>Rows per page</p>
          <Select
            items={PAGE_SIZE_ITEMS}
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={value => table.setPageSize(Number(value))}
          >
            <SelectTrigger size='sm' className='w-17' aria-label={`${idPrefix} rows per page`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {PAGE_SIZE_ITEMS.map(item => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className='flex items-center gap-1'>
          <Button
            variant='outline'
            size='icon-sm'
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label='Previous page'
          >
            <ChevronLeftIcon />
          </Button>

          {showLeftEllipsis && (
            <>
              <Button variant='ghost' size='icon-sm' onClick={() => table.setPageIndex(0)}>
                1
              </Button>
              <span className='text-muted-foreground px-1 text-sm'>…</span>
            </>
          )}

          {pages.map(page => (
            <Button
              key={page}
              variant={currentPage === page ? 'outline' : 'ghost'}
              size='icon-sm'
              onClick={() => table.setPageIndex(page - 1)}
              aria-current={currentPage === page ? 'page' : undefined}
            >
              {page}
            </Button>
          ))}

          {showRightEllipsis && (
            <>
              <span className='text-muted-foreground px-1 text-sm'>…</span>
              <Button variant='ghost' size='icon-sm' onClick={() => table.setPageIndex(totalPages - 1)}>
                {totalPages}
              </Button>
            </>
          )}

          <Button
            variant='outline'
            size='icon-sm'
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label='Next page'
          >
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default DataTablePagination
