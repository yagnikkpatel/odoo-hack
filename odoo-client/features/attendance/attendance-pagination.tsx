'use client'

import type { Table } from '@tanstack/react-table'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue,
} from '@/features/nexacrm/components/ui/select'
import { usePagination } from '@/features/nexacrm/hooks/use-pagination'
import { formatRecordCount } from '@/features/nexacrm/lib/record-count'
import type { Attendance } from './types'

const PAGE_SIZES = [15, 25, 50, 100].map((size) => ({
  label: String(size),
  value: String(size),
}))

export default function AttendancePagination({
  table,
  isLoading,
}: {
  table: Table<Attendance>
  isLoading: boolean
}) {
  const currentPage = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()
  const total = table.getRowCount()
  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage,
    totalPages,
    paginationItemsToDisplay: 5,
  })

  return (
    <div className="flex flex-col-reverse items-center gap-3 px-4 py-3 sm:flex-row sm:justify-between">
      <p className="text-muted-foreground text-sm">{formatRecordCount(total, 'attendance record')}</p>
      <div className="flex items-center gap-4 lg:gap-6">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium max-sm:hidden">Rows per page</p>
          <Select
            items={PAGE_SIZES}
            value={String(table.getState().pagination.pageSize)}
            disabled={isLoading}
            onValueChange={(value) => {
              table.setPagination({ pageIndex: 0, pageSize: Number(value) })
            }}
          >
            <SelectTrigger size="sm" className="w-17" aria-label="attendance rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {PAGE_SIZES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()}
            disabled={isLoading || !table.getCanPreviousPage()} aria-label="Previous page">
            <ChevronLeftIcon />
          </Button>
          {showLeftEllipsis && (
            <>
              <Button variant="ghost" size="icon-sm" disabled={isLoading} onClick={() => table.setPageIndex(0)}>1</Button>
              <span className="text-muted-foreground px-1 text-sm">…</span>
            </>
          )}
          {pages.map((page) => {
            let variant: 'outline' | 'ghost' = 'ghost'
            let ariaCurrent: 'page' | undefined
            if (currentPage === page) {
              variant = 'outline'
              ariaCurrent = 'page'
            }
            return (
              <Button key={page} variant={variant} size="icon-sm" disabled={isLoading}
                onClick={() => table.setPageIndex(page - 1)} aria-current={ariaCurrent}>
                {page}
              </Button>
            )
          })}
          {showRightEllipsis && (
            <>
              <span className="text-muted-foreground px-1 text-sm">…</span>
              <Button variant="ghost" size="icon-sm" disabled={isLoading} onClick={() => table.setPageIndex(totalPages - 1)}>
                {totalPages}
              </Button>
            </>
          )}
          <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()}
            disabled={isLoading || !table.getCanNextPage()} aria-label="Next page">
            <ChevronRightIcon />
          </Button>
        </div>
      </div>
    </div>
  )
}
