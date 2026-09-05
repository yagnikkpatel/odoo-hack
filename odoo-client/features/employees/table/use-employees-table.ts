'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type {
  ColumnFiltersState,
  ColumnSizingState,
  PaginationState,
  Updater,
  VisibilityState,
} from '@tanstack/react-table'
import type { Employee } from '../types'
import { useEmployeesStore } from '../store'
import { INITIAL_COLUMN_ORDER, columns } from './columns'
import { employeeListQuery, employeeQueriesMatch, lastEmployeePage } from './query'

const DEFAULT_PAGE_SIZE = 15

export const useEmployeesTable = ({
  onEditEmployee,
}: {
  onEditEmployee: (employee: Employee) => void
}) => {
  const employees = useEmployeesStore((state) => state.employees)
  const serverPagination = useEmployeesStore((state) => state.pagination)
  const isLoading = useEmployeesStore((state) => state.isLoading)
  const error = useEmployeesStore((state) => state.error)
  const loadEmployees = useEmployeesStore((state) => state.loadEmployees)
  const loadedQuery = useEmployeesStore((state) => state.query)
  const hasHydrated = useEmployeesStore((state) => state.hasHydrated)

  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    phone: false,
    role: false,
  })
  const [columnOrder, setColumnOrder] = useState<string[]>(INITIAL_COLUMN_ORDER)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })
  const [globalFilter, setGlobalFilter] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({
      history: 'replace',
      shallow: true,
      clearOnDefault: true,
    }),
  )

  function resetPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    setRowSelection({})
  }

  function handleGlobalFilterChange(updater: Updater<string>) {
    let next: string
    if (typeof updater === 'function') {
      next = updater(globalFilter)
    } else {
      next = updater
    }
    setGlobalFilter(next)
    resetPage()
  }

  function handleColumnFiltersChange(updater: Updater<ColumnFiltersState>) {
    setColumnFilters(updater)
    resetPage()
  }

  function handlePaginationChange(updater: Updater<PaginationState>) {
    setPagination(updater)
    setRowSelection({})
  }

  const query = useMemo(
    () => employeeListQuery(pagination, globalFilter, columnFilters),
    [pagination, globalFilter, columnFilters],
  )

  // A delete or edit can empty the last page. Only adjust the page when this
  // response belongs to the current query, never a previous search.
  if (
    hasHydrated && !isLoading && !error
    && employeeQueriesMatch(query, loadedQuery)
    && serverPagination.limit === query.limit
    && serverPagination.offset === query.offset
  ) {
    const lastPage = lastEmployeePage(serverPagination.total, pagination.pageSize)
    if (pagination.pageIndex > lastPage) {
      setPagination({ ...pagination, pageIndex: lastPage })
      setRowSelection({})
    }
  }

  const retry = useCallback(() => {
    // The store preserves the readable API error for the retry notice.
    void loadEmployees(query).catch(() => {})
  }, [loadEmployees, query])

  useEffect(() => {
    // Debounce typed searches and filters without downloading the directory.
    const timer = window.setTimeout(retry, 300)
    return () => window.clearTimeout(timer)
  }, [retry])

  const meta = useMemo(() => ({ onEditRow: onEditEmployee }), [onEditEmployee])
  const table = useReactTable({
    data: employees,
    columns,
    state: {
      columnFilters,
      columnVisibility,
      columnOrder,
      columnSizing,
      rowSelection,
      globalFilter,
      pagination,
    },
    meta,
    rowCount: serverPagination.total,
    getRowId: (row) => row.id,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: handleGlobalFilterChange,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualPagination: true,
    enableSorting: false,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    autoResetPageIndex: false,
  })

  return {
    table,
    isLoading: isLoading || !hasHydrated,
    error,
    retry,
    isFiltered: globalFilter.length > 0 || columnFilters.length > 0,
    visibleCount: serverPagination.total,
  }
}
