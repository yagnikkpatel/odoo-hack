'use client'

import { useState } from 'react'
import { PlusIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { parseAsStringLiteral, useQueryState } from '@/features/nexacrm/adapters/query-state'
import { rememberViewType } from '@/features/nexacrm/lib/view-preference'
import type { RecordViewType } from '@/features/nexacrm/lib/view-preference'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { EMPLOYEE_VIEW_TYPES } from './types'
import { useEmployeePermissions } from './permissions'
import EmployeeDetail from './employee-detail'
import EmployeePanel, { useEmployeePreview } from './employee-panel'
import EmployeesGrid from './grid'
import EmployeesStatsCards from './stats-cards'
import EmployeesTable from './table/employees-table'
import EmployeesToolbar from './table/table-toolbar'
import { useEmployeesTable } from './table/use-employees-table'
import CreateEmployeeDialog from './components/create-employee-dialog'

type EmployeesViewProps = { defaultView: 'table' | 'grid' }

export default function EmployeesView(props: EmployeesViewProps) {
  const { user } = useCurrentUser()
  const { canRead, canReadAll } = useEmployeePermissions()
  if (!canRead) {
    return <p role="alert" className="text-muted-foreground py-12">You do not have access to employee profiles.</p>
  }
  if (!canReadAll) {
    return <EmployeeDetail employeeId={user.id} />
  }
  return <EmployeeDirectory {...props} />
}

function EmployeeDirectory({ defaultView }: EmployeesViewProps) {
  const { canCreate, canManageAccounts } = useEmployeePermissions()
  const [createOpen, setCreateOpen] = useState(false)
  const [, setPreviewId] = useEmployeePreview()
  const [viewType, setViewType] = useQueryState(
    'view',
    parseAsStringLiteral(EMPLOYEE_VIEW_TYPES)
      .withDefault(defaultView)
      .withOptions({ history: 'push', shallow: true }),
  )
  const { table, isFiltered, visibleCount, isLoading, error, retry } = useEmployeesTable()

  function selectView(view: RecordViewType) {
    if (view !== 'table' && view !== 'grid') return
    rememberViewType('employees', view)
    setViewType(view)
  }

  let createAction = null
  if (canCreate) {
    createAction = (
      <Button size="sm" className={ACCENT_ICON_BUTTON} onClick={() => setCreateOpen(true)}>
        <PlusIcon />
        <span className="max-sm:hidden">{canManageAccounts ? 'New users' : 'New employee'}</span>
        <span className="sr-only sm:hidden">{canManageAccounts ? 'New users' : 'New employee'}</span>
      </Button>
    )
  }

  let records = <EmployeesTable table={table} isFiltered={isFiltered} isLoading={isLoading} />
  if (viewType === 'grid') {
    records = (
      <EmployeesGrid table={table} onOpenRecord={setPreviewId}
        isFiltered={isFiltered} isLoading={isLoading} />
    )
  }
  if (error) {
    records = (
      <div role="alert" className="border-destructive/20 bg-destructive/5 flex items-center justify-between gap-4 rounded-lg border p-4">
        <div>
          <p className="font-medium">Employees could not be loaded</p>
          <p className="text-muted-foreground mt-1 text-sm">{error}</p>
        </div>
        <Button variant="outline" size="sm" disabled={isLoading} onClick={retry}>
          <RefreshCwIcon /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <EmployeesToolbar table={table} count={visibleCount} viewType={viewType}
        onViewTypeChange={selectView} actions={createAction} isLoading={isLoading} />
      <div className={PAGE_BODY}>
        <EmployeesStatsCards />
        {records}
      </div>
      <EmployeePanel />
      {canCreate && (
        <CreateEmployeeDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={setPreviewId} />
      )}
    </div>
  )
}
