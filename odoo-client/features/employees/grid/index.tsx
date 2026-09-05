'use client'

import type { Table } from '@tanstack/react-table'
import { LoaderCircleIcon } from 'lucide-react'
import type { Employee } from '../types'
import { Card } from '@/features/nexacrm/components/ui/card'
import { EmployeeEmptyState } from '../table/employees-table'
import EmployeePagination from '../table/employee-pagination'
import EmployeeCard from './employee-card'

export default function EmployeesGrid({ table, onOpenRecord, isFiltered, isLoading }: {
  table: Table<Employee>
  onOpenRecord: (id: string) => void
  isFiltered: boolean
  isLoading: boolean
}) {
  const rows = table.getRowModel().rows
  let content = (
    <ul data-testid="employees-grid" className="grid grid-cols-[repeat(auto-fill,minmax(17rem,1fr))] gap-4">
      {rows.map((row) => (
        <EmployeeCard key={row.original.id} employee={row.original}
          onOpen={() => onOpenRecord(row.original.id)} />
      ))}
    </ul>
  )
  if (rows.length === 0) {
    content = <EmployeeEmptyState table={table} isFiltered={isFiltered} />
  }
  if (isLoading) {
    content = (
      <div role="status" className="text-muted-foreground flex items-center justify-center gap-2 py-16">
        <LoaderCircleIcon className="size-5 animate-spin" /> Loading employees…
      </div>
    )
  }
  return (
    <div className="flex flex-1 flex-col gap-4" aria-busy={isLoading}>
      {content}
      <Card className="mt-auto gap-0 py-0">
        <EmployeePagination table={table} isLoading={isLoading} />
      </Card>
    </div>
  )
}
