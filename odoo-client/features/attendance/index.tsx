'use client'

import { useEffect, useState } from 'react'
import {
  ClockIcon,
  DownloadIcon,
  PlusIcon,
  RefreshCwIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { DatePicker } from '@/features/nexacrm/components/ui/date-picker'
import SearchableSelect from '@/features/nexacrm/components/ui/searchable-select'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import {
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from '@/features/nexacrm/adapters/query-state'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import RecordPanel from '@/features/hr/components/record-panel'
import { useAttendancePermissions } from './permissions'
import { listAttendanceEmployees } from './service'
import { loadAllAttendanceRecords } from './records-query'
import type { Attendance } from './types'
import { ATTENDANCE_COLUMNS } from './columns'
import { useAttendanceTable } from './use-attendance-table'
import { useAttendanceRecord } from './use-attendance-record'
import { downloadAttendanceCsv } from './csv'
import AttendanceEditor from './editor'
import AttendanceContent from './record-content'
import AttendanceActions from './record-actions'
import AttendanceResults from './directory-results'
import TodayAttendance from './today-card'
import { useAttendanceStore } from './store'

export default function AttendanceView() {
  const permissions = useAttendancePermissions()
  if (!permissions.canReadOwn && !permissions.canReadAny)
    return <p role="alert">You do not have access to attendance.</p>
  return <AttendanceDirectory />
}

function AttendanceDirectory() {
  const todayError = useAttendanceStore((state) => state.todayError)
  const { canReadAny, canCreate, canCheckIn } = useAttendancePermissions()
  const [employeeId, setEmployeeId] = useQueryState(
    'employee',
    parseAsString.withOptions({ history: 'push', shallow: true }),
  )
  const [recordId, setRecordId] = useQueryState(
    'record',
    parseAsString.withOptions({ history: 'push', shallow: true }),
  )
  const [view, setView] = useQueryState(
    'view',
    parseAsStringLiteral(['table', 'calendar'] as const)
      .withDefault('table')
      .withOptions({ history: 'push', shallow: true }),
  )
  const [scopeParam, setScope] = useQueryState(
    'scope',
    parseAsStringLiteral(['own', 'all'] as const)
      .withDefault('all')
      .withOptions({ history: 'push', shallow: true }),
  )
  const scope = canReadAny ? scopeParam : 'own'
  const [editor, setEditor] = useState<Attendance | 'new' | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [employees, setEmployees] = useState<
    { id: string; name: string; email: string }[]
  >([])
  const [employeesError, setEmployeesError] = useState<string | null>(null)
  const [employeeAttempt, setEmployeeAttempt] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const selected = useAttendanceRecord(recordId)
  const { table, exportQuery, total, invalidRange, loading, error, retry } =
    useAttendanceTable({
      scope,
      employeeId,
      from,
      to,
      calendar: view === 'calendar',
    })

  useEffect(() => {
    if (!canReadAny) return
    let active = true
    void listAttendanceEmployees()
      .then((result) => {
        if (active) {
          setEmployees(result)
          setEmployeesError(null)
        }
      })
      .catch((cause) => {
        if (active)
          setEmployeesError(
            cause instanceof Error
              ? cause.message
              : 'Employees could not be loaded.',
          )
      })
    return () => {
      active = false
    }
  }, [canReadAny, employeeAttempt])

  async function exportAll() {
    setExporting(true)
    setExportError(null)
    try {
      const records = await loadAllAttendanceRecords(exportQuery)
      downloadAttendanceCsv(records)
    } catch (cause) {
      setExportError(
        cause instanceof Error
          ? cause.message
          : 'Attendance could not be exported.',
      )
    } finally {
      setExporting(false)
    }
  }

  const clearFilters = () => {
    setEmployeeId(null)
    setFrom('')
    setTo('')
    table.setGlobalFilter('')
    table.resetColumnFilters()
  }
  return (
    <div className="flex min-h-full flex-col">
      <RecordViewBar
        table={table}
        viewName={scope === 'own' ? 'My attendance' : 'Attendance'}
        count={total}
        icon={ClockIcon}
        showSearch={false}
        showSort={false}
        showFilterFieldLabels={false}
        showFilterChips={false}
        viewType={view}
        viewTypes={['table', 'calendar']}
        onViewTypeChange={(next) => {
          if (next === 'table' || next === 'calendar') setView(next)
        }}
        options={
          <DataTableViewOptions
            table={table}
            reorderableColumnIds={ATTENDANCE_COLUMNS}
            showCopyLink={false}
            onExport={() =>
              downloadAttendanceCsv(table.getPrePaginationRowModel().rows.map((row) => row.original))
            }
          />
        }
        actions={
          canCreate ? (
            <Button
              size="sm"
              className={ACCENT_ICON_BUTTON}
              onClick={() => setEditor('new')}
            >
              <PlusIcon />
              <span className="max-sm:hidden">New attendance</span>
              <span className="sr-only sm:hidden">New attendance</span>
            </Button>
          ) : null
        }
      />
      <div className={PAGE_BODY}>
        {canCheckIn && <TodayAttendance onRetry={retry} />}
        <div className="flex flex-wrap items-end gap-3">
          {canReadAny && (
            <div className="grid w-full gap-1.5 sm:w-44">
              <label
                htmlFor="attendance-view-scope"
                className="text-muted-foreground text-xs"
              >
                Records
              </label>
              <SearchableSelect
                id="attendance-view-scope"
                value={scope}
                options={[
                  { value: 'all', label: 'All attendance' },
                  { value: 'own', label: 'My attendance' },
                ]}
                onChange={(value) => setScope(value === 'own' ? 'own' : 'all')}
              />
            </div>
          )}
          {scope === 'all' && (
            <div className="grid w-full min-w-0 gap-1.5 sm:w-52">
              <label
                htmlFor="attendance-employee"
                className="text-muted-foreground text-xs"
              >
                Employee
              </label>
              <SearchableSelect
                id="attendance-employee"
                label="Employee"
                value={employeeId || 'all'}
                options={[
                  { value: 'all', label: 'All employees' },
                  ...(employeeId &&
                  !employees.some((employee) => employee.id === employeeId)
                    ? [{ value: employeeId, label: 'Selected employee' }]
                    : []),
                  ...employees.map((employee) => ({
                    value: employee.id,
                    label: employee.name,
                  })),
                ]}
                onChange={(value) =>
                  setEmployeeId(value === 'all' ? null : value)
                }
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <label
              htmlFor="attendance-from"
              className="text-muted-foreground text-xs"
            >
              From
            </label>
            <DatePicker
              id="attendance-from"
              value={from}
              onChange={setFrom}
              className="w-40"
            />
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="attendance-to"
              className="text-muted-foreground text-xs"
            >
              To
            </label>
            <DatePicker
              id="attendance-to"
              min={from}
              value={to}
              onChange={setTo}
              className="w-40"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <XIcon />
            Clear filters
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="sm:ml-auto"
            disabled={exporting || invalidRange || loading || Boolean(error)}
            onClick={exportAll}
          >
            <DownloadIcon />
            {exporting ? 'Exporting…' : 'Export matching records'}
          </Button>
        </div>
        {scope === 'all' && employeesError && (
          <div role="alert" className="text-destructive text-sm">
            {employeesError}{' '}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEmployeeAttempt((current) => current + 1)}
            >
              Retry employee list
            </Button>
          </div>
        )}
        {invalidRange && (
          <p role="alert" className="text-destructive text-sm">
            The end date must not be before the start date.
          </p>
        )}
        {exportError && (
          <p role="alert" className="text-destructive text-sm">
            {exportError}
          </p>
        )}
        {error && todayError ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <ClockIcon className="text-muted-foreground mx-auto mb-3 size-5" />
            <h3 className="text-sm font-medium">Attendance history</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Your records will appear here once attendance is available.
            </p>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
          >
            <p className="text-destructive text-sm">{error}</p>
            <Button size="sm" variant="outline" onClick={retry}>
              <RefreshCwIcon />
              Retry
            </Button>
          </div>
        ) : (
          <AttendanceResults
            table={table}
            loading={loading}
            calendar={view === 'calendar'}
            onOpen={setRecordId}
          />
        )}
      </div>
      <RecordPanel
        title="Attendance details"
        open={Boolean(recordId)}
        onClose={() => setRecordId(null)}
        href={selected.record ? '/attendance/' + selected.record.id : undefined}
      >
        {selected.loading && <p role="status">Loading attendance…</p>}
        {selected.error && (
          <div role="alert">
            <p>{selected.error}</p>
            <Button variant="outline" size="sm" onClick={selected.retry}>
              Retry
            </Button>
          </div>
        )}
        {selected.record && (
          <>
            <AttendanceContent
              key={selected.record.id}
              record={selected.record}
            />
            <div className="mt-4">
              <AttendanceActions onEdit={() => setEditor(selected.record!)} />
            </div>
          </>
        )}
      </RecordPanel>
      {editor && (
        <AttendanceEditor
          record={editor === 'new' ? undefined : editor}
          employeeId={scope === 'all' ? employeeId || undefined : undefined}
          onClose={() => setEditor(null)}
          onSaved={(id) => setRecordId(id)}
        />
      )}
    </div>
  )
}
