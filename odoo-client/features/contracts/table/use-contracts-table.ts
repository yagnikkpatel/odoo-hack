'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import type {
  ColumnFiltersState,
  ColumnSizingState,
  PaginationState,
  Updater,
  VisibilityState,
} from '@tanstack/react-table'
import {
  parseAsString,
  useQueryState,
} from '@/features/nexacrm/adapters/query-state'
import { useContractsStore } from '../store'
import type { Contract, ContractListQuery, ContractStatus } from '../types'
import { columns, INITIAL_COLUMN_ORDER } from './columns'

const DEFAULT_PAGE_SIZE = 15

function lastPage(total: number, pageSize: number) {
  return Math.max(0, Math.ceil(total / pageSize) - 1)
}

function queriesMatch(left: ContractListQuery, right: ContractListQuery) {
  return (
    left.limit === right.limit &&
    left.offset === right.offset &&
    left.search === right.search &&
    left.status === right.status &&
    left.employeeId === right.employeeId
  )
}

export function useContractsTable(onEdit: (contract: Contract) => void) {
  const contracts = useContractsStore((state) => state.contracts)
  const serverPagination = useContractsStore((state) => state.pagination)
  const isLoading = useContractsStore((state) => state.isLoading)
  const error = useContractsStore((state) => state.error)
  const loadContracts = useContractsStore((state) => state.loadContracts)
  const loadedQuery = useContractsStore((state) => state.query)
  const hasHydrated = useContractsStore((state) => state.hasHydrated)

  const [employeeId, setEmployeeId] = useQueryState(
    'employee',
    parseAsString.withOptions({ history: 'push', shallow: true }),
  )
  const [globalFilter, setGlobalFilter] = useQueryState(
    'q',
    parseAsString.withDefault('').withOptions({
      history: 'replace',
      shallow: true,
      clearOnDefault: true,
    }),
  )
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    employeeEmail: false,
  })
  const [columnOrder, setColumnOrder] = useState(INITIAL_COLUMN_ORDER)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  function resetPage() {
    setPagination((current) => ({ ...current, pageIndex: 0 }))
    setRowSelection({})
  }

  function changeGlobalFilter(updater: Updater<string>) {
    const next =
      typeof updater === 'function' ? updater(globalFilter) : updater
    setGlobalFilter(next)
    resetPage()
  }

  function changeColumnFilters(updater: Updater<ColumnFiltersState>) {
    setColumnFilters(updater)
    resetPage()
  }

  function changePagination(updater: Updater<PaginationState>) {
    setPagination(updater)
    setRowSelection({})
  }

  const status = columnFilters.find((filter) => filter.id === 'status')
    ?.value as ContractStatus | undefined
  const query = useMemo<ContractListQuery>(
    () => ({
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
      ...(globalFilter.trim() ? { search: globalFilter.trim() } : {}),
      ...(status ? { status } : {}),
      ...(employeeId ? { employeeId } : {}),
    }),
    [employeeId, globalFilter, pagination, status],
  )

  if (
    hasHydrated &&
    !isLoading &&
    !error &&
    queriesMatch(query, loadedQuery) &&
    pagination.pageIndex > lastPage(serverPagination.total, pagination.pageSize)
  ) {
    setPagination((current) => ({
      ...current,
      pageIndex: lastPage(serverPagination.total, current.pageSize),
    }))
    setRowSelection({})
  }

  const retry = useCallback(() => {
    void loadContracts(query).catch(() => {})
  }, [loadContracts, query])

  useEffect(() => {
    const timer = window.setTimeout(retry, 300)
    return () => window.clearTimeout(timer)
  }, [retry])

  const meta = useMemo(() => ({ onEditRow: onEdit }), [onEdit])
  const table = useReactTable({
    data: contracts,
    columns,
    meta,
    state: {
      globalFilter,
      columnFilters,
      columnVisibility,
      columnOrder,
      columnSizing,
      rowSelection,
      pagination,
    },
    rowCount: serverPagination.total,
    getRowId: (row) => row.id,
    onGlobalFilterChange: changeGlobalFilter,
    onColumnFiltersChange: changeColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: changePagination,
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
    employeeId,
    setEmployeeId,
    isLoading: isLoading || !hasHydrated,
    error,
    retry,
    visibleCount: serverPagination.total,
    isFiltered: Boolean(globalFilter || columnFilters.length || employeeId),
  }
}
