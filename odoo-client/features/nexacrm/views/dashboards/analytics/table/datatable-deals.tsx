'use client'

import { useId, useMemo, useState } from 'react'

import type { Column, ColumnDef, ColumnFiltersState, PaginationState, RowData } from '@tanstack/react-table'
import {
  flexRender,
  getCoreRowModel,
  getFacetedMinMaxValues,
  getFacetedRowModel,
  getPaginationRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'

import {
  FileTextIcon,
  MailIcon,
  CheckIcon,
  AlertTriangleIcon,
  Trash2Icon,
  EyeIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SearchIcon,
  EllipsisVerticalIcon
} from 'lucide-react'

import Link from 'next/link'

import { Avatar, AvatarFallback, AvatarImage } from '@/features/nexacrm/components/ui/avatar'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/features/nexacrm/components/ui/input-group'
import { Label } from '@/features/nexacrm/components/ui/label'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem } from '@/features/nexacrm/components/ui/pagination'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/features/nexacrm/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/features/nexacrm/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/features/nexacrm/components/ui/tooltip'

import { usePagination } from '@/features/nexacrm/hooks/use-pagination'

import { cn } from '@/features/nexacrm/lib/utils'

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    filterVariant?: 'text' | 'range' | 'select'
  }
}

export type Item = {
  id: string
  status: 'proposal' | 'new' | 'won' | 'at risk'
  avatar: string
  fallback: string
  contact: string
  company: string
  amount: number
  closeDate: Date
  gap: number
}

const columns: ColumnDef<Item>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onCheckedChange={value => table.toggleAllRowsSelected(!!value)}
        aria-label='Select all'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={value => row.toggleSelected(!!value)}
        aria-label='Select row'
      />
    ),
    size: 50
  },
  {
    header: 'Deal',
    accessorKey: 'id',
    cell: ({ row }) => <span className='text-muted-foreground'>#{row.getValue('id')}</span>,
    size: 100
  },
  {
    header: 'Stage',
    accessorKey: 'status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string

      const statusIcon = {
        proposal: <FileTextIcon className='size-4' />,
        new: <MailIcon className='size-4' />,
        won: <CheckIcon className='size-4' />,
        'at risk': <AlertTriangleIcon className='size-4' />
      }[status]

      return (
        <Avatar className='after:border-none'>
          <AvatarFallback
            className={
              status === 'proposal'
                ? 'bg-sky-600/10 text-sky-600 dark:bg-sky-400/10 dark:text-sky-400'
                : status === 'new'
                  ? 'bg-green-600/10 text-green-600 dark:bg-green-400/10 dark:text-green-400'
                  : status === 'won'
                    ? 'bg-amber-600/10 text-amber-600 dark:bg-amber-400/10 dark:text-amber-400'
                    : 'bg-destructive/10 text-destructive'
            }
          >
            {statusIcon}
          </AvatarFallback>
        </Avatar>
      )
    },
    size: 100,
    meta: {
      filterVariant: 'select'
    }
  },
  {
    header: 'Contact',
    accessorKey: 'contact',
    cell: ({ row }) => (
      <div className='flex items-center gap-2'>
        <Avatar className='size-9'>
          <AvatarImage src={row.original.avatar} alt={row.getValue('contact')} />
          <AvatarFallback className='text-xs'>{row.original.fallback}</AvatarFallback>
        </Avatar>
        <div className='flex flex-col'>
          <span className='font-medium'>{row.getValue('contact')}</span>
          <span className='text-muted-foreground'>{row.original.company}</span>
        </div>
      </div>
    ),
    size: 280
  },
  {
    header: 'Amount',
    accessorKey: 'amount',
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount'))

      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount)

      return <span>{formatted}</span>
    }
  },
  {
    header: 'Close date',
    accessorKey: 'closeDate',
    cell: ({ row }) => {
      const date = row.getValue('closeDate') as Date

      const formatted = date.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit'
      })

      return <span className='text-muted-foreground'>{formatted}</span>
    }
  },
  {
    header: 'Gap',
    accessorKey: 'gap',
    cell: ({ row }) => {
      const gap = parseFloat(row.getValue('gap'))

      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(gap)

      return (
        <>
          {row.original.gap === 0 ? (
            <Badge className='h-auto rounded-sm bg-green-600/10 text-green-600 focus-visible:ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:focus-visible:ring-green-400/40 [a&]:hover:bg-green-600/5 dark:[a&]:hover:bg-green-400/5'>
              On plan
            </Badge>
          ) : (
            <span>{formatted}</span>
          )}
        </>
      )
    }
  },
  {
    id: 'actions',
    header: () => 'Actions',
    cell: () => (
      <div className='flex items-center justify-center gap-1'>
        <Tooltip>
          <TooltipTrigger render={<Button variant='ghost' size='icon' aria-label='Delete item' />}>
            <Trash2Icon className='size-4.5' />
          </TooltipTrigger>
          <TooltipContent>
            <p>Delete</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button variant='ghost' size='icon' aria-label='View item' />}>
            <EyeIcon className='size-4.5' />
          </TooltipTrigger>
          <TooltipContent>
            <p>View</p>
          </TooltipContent>
        </Tooltip>
        <RowActions />
      </div>
    ),
    size: 96,
    enableHiding: false
  }
]

/*
 * ! THIS FILE MUST LIVE IN A `table/` DIRECTORY - THE DIRECTORY NAME IS LOAD-BEARING.
 * ! `eslint.config.mjs` turns `react-hooks/incompatible-library` off for any `table/` directory
 * ! under `src/views`. `useReactTable()` returns an instance React Compiler cannot memoize, so
 * ! anywhere else this file becomes the only "Compilation Skipped" warning in the repo. Fix by
 * ! location, not by an eslint-disable - this codebase has none for that rule.
 */
const DealsDatatable = ({ data }: { data: Item[] }) => {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const pageSize = 5

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSize
  })

  const table = useReactTable({
    data,
    columns,
    state: {
      columnFilters,
      pagination
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getFacetedMinMaxValues: getFacetedMinMaxValues(),
    enableSortingRemoval: false,
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination
  })

  const { pages, showLeftEllipsis, showRightEllipsis } = usePagination({
    currentPage: table.getState().pagination.pageIndex + 1,
    totalPages: table.getPageCount(),
    paginationItemsToDisplay: 2
  })

  return (
    <div className='w-full'>
      <div className='border-b'>
        <div className='flex gap-6 p-6 max-lg:flex-col lg:items-center lg:justify-between'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2'>
              <Label htmlFor='#rowSelect' className='text-muted-foreground text-base font-normal max-sm:sr-only'>
                Show
              </Label>
              <Select
                items={[5, 10, 25, 50].map(s => ({
                  label: String(s),
                  value: String(s)
                }))}
                value={table.getState().pagination.pageSize.toString()}
                onValueChange={(value: string | null) => {
                  if (value) table.setPageSize(Number(value))
                }}
              >
                <SelectTrigger id='rowSelect' className='w-fit whitespace-nowrap'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {[5, 10, 25, 50].map(pageSize => (
                      <SelectItem key={pageSize} value={pageSize.toString()}>
                        {pageSize}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button render={<Link href='/opportunities' />}>New deal</Button>
          </div>
          <div className='flex flex-1 flex-wrap items-center gap-4 lg:justify-end'>
            <Filter column={table.getColumn('contact')!} />
            <Filter column={table.getColumn('status')!} />
          </div>
        </div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id} className='h-14 border-t'>
                {headerGroup.headers.map(header => {
                  return (
                    <TableHead
                      key={header.id}
                      style={{ width: `${header.getSize()}px` }}
                      className='text-muted-foreground first:pl-4 last:px-4 last:text-center'
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <div
                          className={cn(
                            header.column.getCanSort() &&
                              'flex h-full cursor-pointer items-center justify-between gap-2 select-none'
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                          onKeyDown={e => {
                            if (header.column.getCanSort() && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault()
                              header.column.getToggleSortingHandler()?.(e)
                            }
                          }}
                          tabIndex={header.column.getCanSort() ? 0 : undefined}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ChevronUpIcon className='shrink-0 opacity-60' size={16} aria-hidden='true' />,
                            desc: <ChevronDownIcon className='shrink-0 opacity-60' size={16} aria-hidden='true' />
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id} className='h-14 first:pl-4'>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className='h-24 text-center'>
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className='flex items-center justify-between gap-3 px-6 py-4 max-sm:flex-col md:max-lg:flex-col'>
        <p className='text-muted-foreground text-sm whitespace-nowrap' aria-live='polite'>
          Showing{' '}
          <span>
            {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{' '}
            {Math.min(
              Math.max(
                table.getState().pagination.pageIndex * table.getState().pagination.pageSize +
                  table.getState().pagination.pageSize,
                0
              ),
              table.getRowCount()
            )}
          </span>{' '}
          of <span>{table.getRowCount().toString()} entries</span>
        </p>

        <div>
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <Button
                  className='disabled:pointer-events-none disabled:opacity-50'
                  variant='ghost'
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                  aria-label='Go to previous page'
                >
                  <ChevronLeftIcon aria-hidden='true' />
                  Previous
                </Button>
              </PaginationItem>

              {showLeftEllipsis && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {pages.map(page => {
                const isActive = page === table.getState().pagination.pageIndex + 1

                return (
                  <PaginationItem key={page}>
                    <Button
                      size='icon'
                      className={`${!isActive && 'bg-primary/10 text-primary hover:bg-primary/20 focus-visible:ring-primary/20 dark:focus-visible:ring-primary/40'}`}
                      onClick={() => table.setPageIndex(page - 1)}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {page}
                    </Button>
                  </PaginationItem>
                )
              })}

              {showRightEllipsis && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              <PaginationItem>
                <Button
                  className='disabled:pointer-events-none disabled:opacity-50'
                  variant='ghost'
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                  aria-label='Go to next page'
                >
                  Next
                  <ChevronRightIcon aria-hidden='true' />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  )
}

export default DealsDatatable

function Filter<TData extends RowData>({ column }: { column: Column<TData, unknown> }) {
  const id = useId()
  const columnFilterValue = column.getFilterValue()
  const { filterVariant } = column.columnDef.meta ?? {}

  const columnHeader = typeof column.columnDef.header === 'string' ? column.columnDef.header : ''

  const facetedUniqueValues = column.getFacetedUniqueValues()

  const sortedUniqueValues = useMemo(() => {
    if (filterVariant === 'range') return []

    const values = Array.from(facetedUniqueValues.keys())

    const flattenedValues = values.reduce((acc: string[], curr) => {
      if (Array.isArray(curr)) {
        return [...acc, ...curr]
      }

      return [...acc, curr]
    }, [])

    return Array.from(new Set(flattenedValues)).sort()
  }, [facetedUniqueValues, filterVariant])

  if (filterVariant === 'select') {
    return (
      <div className='w-full max-w-2xs'>
        <Label htmlFor={`${id}-select`} className='sr-only'>
          {columnHeader}
        </Label>
        <Select
          items={[
            { label: 'All', value: 'all' },
            ...sortedUniqueValues.map(value => ({
              label: String(value),
              value: String(value)
            }))
          ]}
          value={columnFilterValue?.toString() ?? 'all'}
          onValueChange={(value: string | null) => {
            column.setFilterValue(value === 'all' || value === null ? undefined : value)
          }}
        >
          <SelectTrigger id={`${id}-select`} className='w-full capitalize'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value='all'>All</SelectItem>
              {sortedUniqueValues.map(value => (
                <SelectItem key={String(value)} value={String(value)} className='capitalize'>
                  {String(value)}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    )
  }

  return (
    <div className='w-full max-w-2xs'>
      <Label htmlFor={`${id}-input`} className='sr-only'>
        {columnHeader}
      </Label>
      <InputGroup>
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          id={`${id}-input`}
          value={(columnFilterValue ?? '') as string}
          onChange={e => column.setFilterValue(e.target.value)}
          placeholder={`Search ${columnHeader.toLowerCase()}`}
          type='text'
        />
      </InputGroup>
    </div>
  )
}

function RowActions() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size='icon' variant='ghost' aria-label='Edit item' />}>
        <EllipsisVerticalIcon className='size-4.5' aria-hidden='true' />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <span>Edit</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <span>Duplicate</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
