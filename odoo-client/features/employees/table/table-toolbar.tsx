'use client'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Table } from '@tanstack/react-table'
import { UsersIcon } from 'lucide-react'
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import ImportDialog from '@/features/nexacrm/components/data-table/import-dialog'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import type { RecordViewType } from '@/features/nexacrm/components/data-table/record-view-bar'
import { deriveFilterOptions } from '@/features/nexacrm/components/data-table/derive-filter-options'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useEmployeesStore } from '../store'
import { EMPLOYEE_VIEW_TYPES, STATUS_LABELS, employeeName } from '../types'
import type { Employee } from '../types'
import {
  createEmployeeRowParser,
  downloadEmployeesCsv,
  EMPLOYEE_IMPORT_FIELDS,
} from '../csv'
import { REORDERABLE_COLUMN_IDS } from './columns'

export default function EmployeesToolbar({
  table,
  count,
  viewType,
  onViewTypeChange,
  actions,
}: {
  table: Table<Employee>
  count: number
  viewType: RecordViewType
  onViewTypeChange: (view: RecordViewType) => void
  actions: ReactNode
}) {
  const employees = useEmployeesStore((state) => state.employees)
  const addEmployees = useEmployeesStore((state) => state.addEmployees)
  const { can } = useCurrentUser()
  const [importOpen, setImportOpen] = useState(false)
  return (
    <>
      <RecordViewBar
        table={table}
        viewName="Employees"
        count={count}
        icon={UsersIcon}
        searchPlaceholder="Search employees…"
        actions={actions}
        viewType={viewType}
        onViewTypeChange={onViewTypeChange}
        viewTypes={EMPLOYEE_VIEW_TYPES}
        dynamicFilterOptions={{
          department: deriveFilterOptions(
            table,
            (employee) => employee.department,
          ),
          jobTitle: deriveFilterOptions(table, (employee) => employee.jobTitle),
          managerId: employees.map((employee) => ({
            label: employeeName(employee),
            value: employee.id,
          })),
          status: Object.entries(STATUS_LABELS).map(([value, label]) => ({
            value,
            label,
          })),
        }}
        options={
          <DataTableViewOptions
            table={table}
            reorderableColumnIds={REORDERABLE_COLUMN_IDS}
            onExport={() =>
              downloadEmployeesCsv(
                table.getFilteredRowModel().rows.map((row) => row.original),
              )
            }
            onImport={
              can('records:create') ? () => setImportOpen(true) : undefined
            }
          />
        }
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        entity={{ singular: 'employee', plural: 'employees' }}
        fields={EMPLOYEE_IMPORT_FIELDS}
        parseRow={createEmployeeRowParser(employees)}
        onImport={addEmployees}
      />
    </>
  )
}
