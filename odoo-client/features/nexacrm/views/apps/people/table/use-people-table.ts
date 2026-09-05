'use client'

// React Imports
import { useEffect, useMemo, useState } from 'react'

// Third-party Imports
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'
import type { Updater } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import type {
  ColumnFiltersState,
  ColumnSizingState,
  PaginationState,
  SortingState,
  VisibilityState
} from '@tanstack/react-table'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'

// Store Imports
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'

// Local Imports
import { INITIAL_COLUMN_ORDER, columns } from './columns'

const DEFAULT_PAGE_SIZE = 15

export const usePeopleTable = ({ onEditPerson }: { onEditPerson: (person: Person) => void }) => {
  const people = usePeopleStore(state => state.people)

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    city: false,
    country: false,
    createdById: false,
    createdAt: false
  })

  const [columnOrder, setColumnOrder] = useState<string[]>(INITIAL_COLUMN_ORDER)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState({})

  const [globalFilter, setGlobalFilter] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({ history: 'replace', shallow: true, clearOnDefault: true })
  )

  const handleGlobalFilterChange = (updater: Updater<string>) =>
    setGlobalFilter(typeof updater === 'function' ? updater(globalFilter) : updater)

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE })
  const [showSummary, setShowSummary] = useState(true)

  const meta = useMemo(() => ({ onEditRow: onEditPerson }), [onEditPerson])

  const table = useReactTable({
    data: people,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      columnSizing,
      rowSelection,
      globalFilter,
      pagination
    },
    meta,
    getRowId: row => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: handleGlobalFilterChange,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    enableSortingRemoval: false,
    autoResetPageIndex: false
  })

  useEffect(() => {
    table.resetPageIndex()
  }, [table, globalFilter, columnFilters])

  return {
    table,
    people,
    showSummary,
    setShowSummary,
    isFiltered: globalFilter.length > 0 || columnFilters.length > 0,
    visibleCount: table.getFilteredRowModel().rows.length
  }
}
