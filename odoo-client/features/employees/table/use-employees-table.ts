'use client'

// React Imports
import { useEffect, useMemo, useState } from 'react'

// Third-party Imports
import {
  parseAsString,
  useQueryState,
} from '@/features/nexacrm/adapters/query-state'
import type { Updater } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type {
  ColumnFiltersState,
  ColumnSizingState,
  PaginationState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table'

// Type Imports
import type { Employee } from '@/features/employees/types'

// Store Imports
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { useEmployeesStore } from '@/features/employees/store'

// Local Imports
import { INITIAL_COLUMN_ORDER, columns } from './columns'

const DEFAULT_PAGE_SIZE = 15

export const useEmployeesTable = ({
  onEditEmployee,
}: {
  onEditEmployee: (employee: Employee) => void
}) => {
  const employees = useEmployeesStore((state) => state.employees)

  const companies = useCompaniesStore(state => state.companies)
  const data = useMemo(() => employees.map(employee => ({
    ...employee,
    companyName: companies.find(company => company.id === employee.companyId)?.name || '',
  })), [employees, companies])

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    phone: false,
  })

  const [columnOrder, setColumnOrder] = useState<string[]>(INITIAL_COLUMN_ORDER)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState({})

  const [globalFilter, setGlobalFilter] = useQueryState(
    'q',
    parseAsString
      .withDefault('')
      .withOptions({ history: 'replace', shallow: true, clearOnDefault: true }),
  )

  const handleGlobalFilterChange = (updater: Updater<string>) =>
    setGlobalFilter(
      typeof updater === 'function' ? updater(globalFilter) : updater,
    )

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: DEFAULT_PAGE_SIZE,
  })

  const meta = useMemo(() => ({ onEditRow: onEditEmployee }), [onEditEmployee])

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      columnSizing,
      rowSelection,
      globalFilter,
      pagination,
    },
    meta,
    getRowId: (row) => row.id,
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
    autoResetPageIndex: false,
  })

  useEffect(() => {
    table.resetPageIndex()
  }, [table, globalFilter, columnFilters])

  return {
    table,
    employees,
    isFiltered: globalFilter.length > 0 || columnFilters.length > 0,
    visibleCount: table.getFilteredRowModel().rows.length,
  }
}
