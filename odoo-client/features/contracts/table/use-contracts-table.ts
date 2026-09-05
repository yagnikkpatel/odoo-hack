'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
} from '@tanstack/react-table'
import type {
  ColumnFiltersState,
  ColumnSizingState,
  PaginationState,
  SortingState,
  VisibilityState,
  Updater,
} from '@tanstack/react-table'
import {
  parseAsString,
  useQueryState,
} from '@/features/nexacrm/adapters/query-state'
import { useEmployeesStore } from '@/features/employees/store'
import { employeeName } from '@/features/employees/types'
import { useContractsStore } from '../store'
import { contractStatus } from '../types'
import type { Contract, ContractRow } from '../types'
import { columns, INITIAL_COLUMN_ORDER } from './columns'

export function useContractsTable(onEdit: (contract: Contract) => void) {
  const contracts = useContractsStore((state) => state.contracts)
  const employees = useEmployeesStore((state) => state.employees)
  const [employeeId, setEmployeeId] = useQueryState(
    'employee',
    parseAsString.withOptions({ history: 'push', shallow: true }),
  )
  const data = useMemo<ContractRow[]>(
    () =>
      contracts
        .filter((contract) => !employeeId || contract.employeeId === employeeId)
        .map((contract) => {
          const employee = employees.find(
            (item) => item.id === contract.employeeId,
          )
          return {
            ...contract,
            employeeName: employee
              ? employeeName(employee)
              : 'Employee unavailable',
            avatar: employee?.avatar,
            status: contractStatus(contract),
          }
        }),
    [contracts, employees, employeeId],
  )
  const [globalFilter, setGlobalFilter] = useQueryState(
    'q',
    parseAsString
      .withDefault('')
      .withOptions({ history: 'replace', shallow: true, clearOnDefault: true }),
  )
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    department: false,
    jobPosition: false,
    salaryStructure: false,
  })
  const [columnOrder, setColumnOrder] = useState(INITIAL_COLUMN_ORDER)
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  })
  const meta = useMemo(() => ({ onEditRow: onEdit }), [onEdit])
  const table = useReactTable({
    data,
    columns,
    meta,
    state: {
      globalFilter,
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      columnSizing,
      rowSelection,
      pagination,
    },
    getRowId: (row) => row.id,
    onGlobalFilterChange: (value: Updater<string>) =>
      setGlobalFilter(
        typeof value === 'function' ? value(globalFilter) : value,
      ),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
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
    table.resetRowSelection()
  }, [table, globalFilter, columnFilters, employeeId])
  const pageCount = table.getPageCount()
  useEffect(() => {
    if (pagination.pageIndex >= pageCount)
      table.setPageIndex(Math.max(0, pageCount - 1))
  }, [pageCount, pagination.pageIndex, table])
  return {
    table,
    employeeId,
    setEmployeeId,
    employees,
    isFiltered: !!globalFilter || columnFilters.length > 0,
  }
}
