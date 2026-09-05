'use client'
import DataConnectionNotice from '@/features/hr/components/data-connection-notice'
import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CalendarIcon, ClockIcon, PlusIcon, UsersIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
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
import { useRecordsTable } from '@/features/hr/use-records-table'
import RecordsTable from '@/features/hr/components/records-table'
import RecordPanel from '@/features/hr/components/record-panel'
import { hoursLabel } from '@/features/attendance/types'
import { useSchedulesStore } from './store'
import { SCHEDULE_TYPES, weeklyMinutes } from './types'
import type { WorkingSchedule, ScheduleRow } from './types'
import ScheduleEditor from './editor'
import ScheduleContent from './record-content'
import ScheduleActions from './record-actions'
import WeekPattern from './week-pattern'

const COLUMN_IDS = ['name', 'type', 'weeklyMinutes', 'employeeCount']
export default function SchedulesView() {
  const schedules = useSchedulesStore((state) => state.schedules)
  const assignments = useSchedulesStore((state) => state.assignments)
  const hydrated = useSchedulesStore((state) => state.hasHydrated)
  const employees = useEmployeesStore((state) => state.employees)
  const { can } = useCurrentUser()
  const [editor, setEditor] = useState<WorkingSchedule | 'new' | null>(null)
  const [id, setId] = useQueryState(
    'record',
    parseAsString.withOptions({ history: 'push', shallow: true }),
  )
  const [view, setView] = useQueryState(
    'view',
    parseAsStringLiteral(['table', 'calendar'] as const)
      .withDefault('table')
      .withOptions({ history: 'push', shallow: true }),
  )
  const data = useMemo<ScheduleRow[]>(
    () =>
      schedules.map((schedule) => ({
        ...schedule,
        weeklyMinutes: weeklyMinutes(schedule),
        employeeCount: employees.filter(
          (employee) => assignments[employee.id] === schedule.id,
        ).length,
      })),
    [schedules, assignments, employees],
  )
  const columns = useMemo<ColumnDef<ScheduleRow>[]>(
    () => [
      {
        accessorKey: 'name',
        size: 290,
        meta: { label: 'Schedule', icon: CalendarIcon, textFilter: true },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Schedule" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.name}</span>
        ),
      },
      {
        accessorKey: 'type',
        size: 165,
        meta: {
          label: 'Type',
          icon: CalendarIcon,
          filterOptions: Object.entries(SCHEDULE_TYPES).map(
            ([value, label]) => ({ value, label }),
          ),
        },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Type" />
        ),
        filterFn: (row, id, value) => row.getValue(id) === value,
        cell: ({ row }) => (
          <Badge variant="secondary">{SCHEDULE_TYPES[row.original.type]}</Badge>
        ),
      },
      {
        accessorKey: 'weeklyMinutes',
        size: 175,
        meta: { label: 'Weekly hours', icon: ClockIcon },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Weekly hours" />
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {hoursLabel(row.original.weeklyMinutes)}
          </span>
        ),
      },
      {
        accessorKey: 'employeeCount',
        size: 150,
        meta: { label: 'Employees', icon: UsersIcon },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Employees" />
        ),
      },
      {
        id: 'actions',
        size: 48,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <ScheduleActions
            schedule={row.original}
            onEdit={() => setEditor(row.original)}
          />
        ),
      },
    ],
    [],
  )
  const table = useRecordsTable({ data, columns, columnIds: COLUMN_IDS })
  const selected = schedules.find((schedule) => schedule.id === id)
  return (
    <div className="flex min-h-full flex-col">
      <RecordViewBar
        table={table}
        viewName="Working schedules"
        count={table.getFilteredRowModel().rows.length}
        icon={CalendarIcon}
        searchPlaceholder="Search schedules…"
        viewType={view}
        viewTypes={['table', 'calendar']}
        onViewTypeChange={(next) => {
          if (next === 'table' || next === 'calendar') setView(next)
        }}
        options={
          <DataTableViewOptions
            table={table}
            reorderableColumnIds={COLUMN_IDS}
            onExport={() =>
              downloadCsv(
                'working-schedules.csv',
                table
                  .getPrePaginationRowModel()
                  .rows.map(({ original: schedule }) => ({
                    Schedule: /^\s*[=+\-@]/.test(schedule.name)
                      ? "'" + schedule.name
                      : schedule.name,
                    Type: SCHEDULE_TYPES[schedule.type],
                    'Weekly hours': schedule.weeklyMinutes / 60,
                    Employees: schedule.employeeCount,
                  })),
              )
            }
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
              <span className="max-sm:hidden">New schedule</span>
              <span className="sr-only sm:hidden">New schedule</span>
            </Button>
          ) : undefined
        }
      />
      <div className={PAGE_BODY}>
        <DataConnectionNotice />
        {view === 'table' ? (
          <RecordsTable
            table={table}
            columnIds={COLUMN_IDS}
            loading={!hydrated}
            label="working schedules"
            onOpen={(schedule) => setId(schedule.id)}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Recurring weekly calendar · Monday to Sunday
            </p>
            {table
              .getPrePaginationRowModel()
              .rows.map(({ original: schedule }) => (
                <Card key={schedule.id} className="gap-0">
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 truncate text-left text-sm font-medium hover:underline"
                        onClick={() => setId(schedule.id)}
                      >
                        {schedule.name}
                      </button>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {hoursLabel(schedule.weeklyMinutes)} / week
                      </span>
                    </div>
                    <WeekPattern schedule={schedule} />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setId(schedule.id)}
                    >
                      View details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            {table.getFilteredRowModel().rows.length === 0 && (
              <p className="text-muted-foreground rounded-lg border p-8 text-center text-sm">
                No schedules match your filters.
              </p>
            )}
          </div>
        )}
      </div>
      <RecordPanel
        title="Working schedule details"
        open={!!selected}
        onClose={() => setId(null)}
        href={selected ? '/attendance/schedules/' + selected.id : undefined}
        actions={
          selected ? (
            <ScheduleActions
              schedule={selected}
              detail
              onEdit={() => setEditor(selected)}
              onDeleted={() => setId(null)}
            />
          ) : undefined
        }
      >
        {selected && (
          <>
            <ScheduleContent key={selected.id} schedule={selected} />
            {can('records:update') && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => setEditor(selected)}
              >
                Edit schedule
              </Button>
            )}
          </>
        )}
      </RecordPanel>
      {editor && (
        <ScheduleEditor
          schedule={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setId(id)
            table.setGlobalFilter('')
            table.resetColumnFilters()
          }}
        />
      )}
    </div>
  )
}
