'use client'
import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import {
  parseAsStringLiteral,
  useQueryState,
} from '@/features/nexacrm/adapters/query-state'
import { rememberViewType } from '@/features/nexacrm/lib/view-preference'
import type { RecordViewType } from '@/features/nexacrm/lib/view-preference'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { EMPLOYEE_VIEW_TYPES } from './types'
import EmployeePanel, { useEmployeePreview } from './employee-panel'
import EmployeesGrid from './grid'
import EmployeesTable from './table/employees-table'
import EmployeesToolbar from './table/table-toolbar'
import { useEmployeesTable } from './table/use-employees-table'
import CreateEmployeeDialog from './components/create-employee-dialog'

export default function EmployeesView({
  defaultView,
}: {
  defaultView: 'table' | 'grid'
}) {
  const { can } = useCurrentUser()
  const [createOpen, setCreateOpen] = useState(false)
  const [, setPreviewId] = useEmployeePreview()
  const [viewType, setViewType] = useQueryState(
    'view',
    parseAsStringLiteral(EMPLOYEE_VIEW_TYPES)
      .withDefault(defaultView)
      .withOptions({ history: 'push', shallow: true }),
  )
  const { table, isFiltered, visibleCount } = useEmployeesTable({
    onEditEmployee: (employee) => setPreviewId(employee.id),
  })
  const selectView = (view: RecordViewType) => {
    if (view !== 'table' && view !== 'grid') return
    rememberViewType('employees', view)
    setViewType(view)
  }
  return (
    <div className="flex min-h-full flex-col">
      <EmployeesToolbar
        table={table}
        count={visibleCount}
        viewType={viewType}
        onViewTypeChange={selectView}
        actions={
          can('records:create') ? (
            <Button
              size="sm"
              className={ACCENT_ICON_BUTTON}
              onClick={() => setCreateOpen(true)}
            >
              <PlusIcon />
              <span className="max-sm:hidden">New employee</span>
              <span className="sr-only sm:hidden">New employee</span>
            </Button>
          ) : null
        }
      />
      <div className={PAGE_BODY}>
        {viewType === 'grid' ? (
          <EmployeesGrid table={table} onOpenRecord={setPreviewId} />
        ) : (
          <EmployeesTable table={table} isFiltered={isFiltered} />
        )}
      </div>
      <EmployeePanel />
      <CreateEmployeeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={setPreviewId}
      />
    </div>
  )
}
