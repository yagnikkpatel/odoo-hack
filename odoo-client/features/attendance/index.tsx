'use client'
import { useMemo, useState } from 'react'
import { ClockIcon, PlusIcon, XIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import { DatePicker } from '@/features/nexacrm/components/ui/date-picker'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import {
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from '@/features/nexacrm/adapters/query-state'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { downloadCsv } from '@/features/nexacrm/utils/csv'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { useEmployeesStore } from '@/features/employees/store'
import { employeeName } from '@/features/employees/types'
import { useRecordsTable } from '@/features/hr/use-records-table'
import RecordsTable from '@/features/hr/components/records-table'
import RecordPanel from '@/features/hr/components/record-panel'
import { Choice } from '@/features/hr/components/form'
import { useAttendanceStore } from './store'
import {
  attendanceStatus,
  hoursLabel,
  workedMinutes,
  ATTENDANCE_STATUSES,
} from './types'
import type { Attendance, AttendanceRow } from './types'
import { ATTENDANCE_COLUMNS, attendanceColumns } from './columns'
import AttendanceEditor from './editor'
import AttendanceContent from './record-content'
import AttendanceActions from './record-actions'
import AttendanceStatusBadge from './status-badge'
import RecordCalendar from './record-calendar'

export default function AttendanceView() {
  const employees = useEmployeesStore((state) => state.employees)
  const records = useAttendanceStore((state) => state.records)
  const hydrated = useAttendanceStore((state) => state.hasHydrated)
  const { can } = useCurrentUser()
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
  const [editor, setEditor] = useState<Attendance | 'new' | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const data = useMemo<AttendanceRow[]>(
    () =>
      records
        .filter(
          (record) =>
            (!employeeId || record.employeeId === employeeId) &&
            (!from || record.checkIn.slice(0, 10) >= from) &&
            (!to || record.checkIn.slice(0, 10) <= to),
        )
        .map((record) => {
          const employee = employees.find(
            (employee) => employee.id === record.employeeId,
          )
          return {
            ...record,
            employeeName: employee
              ? employeeName(employee)
              : 'Employee unavailable',
            avatar: employee?.avatar,
            workedMinutes: workedMinutes(record),
            status: attendanceStatus(record),
          }
        }),
    [records, employees, employeeId, from, to],
  )
  const columns = useMemo(() => attendanceColumns(setEditor), [])
  const table = useRecordsTable({
    data,
    columns,
    columnIds: ATTENDANCE_COLUMNS,
  })
  const selected = records.find((record) => record.id === recordId)
  const exportRows = () =>
    downloadCsv(
      'attendance.csv',
      table.getPrePaginationRowModel().rows.map(({ original: row }) => ({
        Employee: /^\s*[=+\-@]/.test(row.employeeName)
          ? "'" + row.employeeName
          : row.employeeName,
        'Employee ID': row.employeeId,
        'Check in (local)': row.checkIn,
        'Check out (local)': row.checkOut,
        'Break minutes': row.breakMinutes,
        'Worked minutes': row.workedMinutes,
        Status: ATTENDANCE_STATUSES[row.status],
        Corrections: row.corrections.length,
      })),
    )
  return (
    <div className="flex min-h-full flex-col">
      <RecordViewBar
        table={table}
        viewName="Attendance"
        count={table.getFilteredRowModel().rows.length}
        icon={ClockIcon}
        searchPlaceholder="Search attendance…"
        viewType={view}
        viewTypes={['table', 'calendar']}
        onViewTypeChange={(next) => {
          if (next === 'table' || next === 'calendar') setView(next)
        }}
        options={
          <DataTableViewOptions
            table={table}
            reorderableColumnIds={ATTENDANCE_COLUMNS}
            onExport={exportRows}
          />
        }
        actions={
          can('records:create') ? (
            <Button
              size="sm"
              className={ACCENT_ICON_BUTTON}
              onClick={() => setEditor('new')}
            >
              <PlusIcon />
              <span className="max-sm:hidden">New attendance</span>
              <span className="sr-only sm:hidden">New attendance</span>
            </Button>
          ) : undefined
        }
      />
      <div className={PAGE_BODY}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="grid w-full gap-1.5 sm:w-52">
            <label
              htmlFor="attendance-scope"
              className="text-muted-foreground text-xs"
            >
              Employee
            </label>
            <Choice
              id="attendance-scope"
              value={employeeId || 'all'}
              options={[
                { value: 'all', label: 'All employees' },
                ...employees.map((employee) => ({
                  value: employee.id,
                  label: employeeName(employee),
                })),
              ]}
              onChange={(value) =>
                setEmployeeId(value === 'all' ? null : value)
              }
            />
          </div>
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
          {(employeeId || from || to) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEmployeeId(null)
                setFrom('')
                setTo('')
              }}
            >
              <XIcon />
              Clear scope
            </Button>
          )}
          <p className="text-muted-foreground ml-auto text-xs">
            Demo data · Local time · Resets on reload
          </p>
        </div>
        {from && to && from > to && (
          <p role="alert" className="text-destructive text-sm">
            The end date must not be before the start date.
          </p>
        )}
        {view === 'table' ? (
          <RecordsTable
            table={table}
            columnIds={ATTENDANCE_COLUMNS}
            loading={!hydrated}
            label="attendance records"
            onOpen={(record) => setRecordId(record.id)}
          />
        ) : (
          <RecordCalendar
            table={table}
            getId={(record) => record.id}
            getDate={(record) => record.checkIn}
            getTitle={(record) => record.employeeName}
            getMeta={(record) => record.checkIn.slice(11)}
            onOpenRecord={(record) => setRecordId(record.id)}
            testId="attendance-calendar"
            renderCard={(record) => (
              <Card className="gap-0 py-0 shadow-none">
                <CardContent className="p-0">
                  <button
                    type="button"
                    onClick={() => setRecordId(record.id)}
                    className="hover:bg-muted/50 flex w-full min-w-0 flex-col gap-2 rounded-lg p-2.5 text-left focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="flex w-full min-w-0 items-center gap-2">
                      <PersonAvatar
                        name={record.employeeName}
                        src={record.avatar}
                        className="size-5!"
                      />
                      <span className="truncate text-xs font-medium">
                        {record.employeeName}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {record.checkIn.slice(11)} ·{' '}
                      {hoursLabel(record.workedMinutes)}
                    </span>
                    <AttendanceStatusBadge status={record.status} />
                  </button>
                </CardContent>
              </Card>
            )}
          />
        )}
      </div>
      <RecordPanel
        title="Attendance details"
        open={!!selected}
        onClose={() => setRecordId(null)}
        href={selected ? '/attendance/' + selected.id : undefined}
      >
        {selected && (
          <>
            <AttendanceContent key={selected.id} record={selected} />
            <div className="mt-4">
              <AttendanceActions
                record={selected}
                detail
                onEdit={() => setEditor(selected)}
                onDeleted={() => setRecordId(null)}
              />
            </div>
          </>
        )}
      </RecordPanel>
      {editor && (
        <AttendanceEditor
          record={editor === 'new' ? undefined : editor}
          employeeId={employeeId || undefined}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setRecordId(id)
            table.setGlobalFilter('')
            table.resetColumnFilters()
          }}
        />
      )}
    </div>
  )
}
