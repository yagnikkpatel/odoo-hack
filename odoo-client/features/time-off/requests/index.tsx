'use client'

import { useMemo, useState } from 'react'
import {
  CalendarDaysIcon,
  CalendarIcon,
  CircleCheckIcon,
  ClockIcon,
  FileTextIcon,
  PlusIcon,
  UsersIcon,
  XIcon
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import { Button } from '@/features/nexacrm/components/ui/button'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { downloadCsv } from '@/features/nexacrm/utils/csv'
import { Choice } from '@/features/hr/components/form'
import RecordPanel from '@/features/hr/components/record-panel'
import { useEmployeeOptions } from '@/features/hr/employee-options'
import { useTimeOffPermissions } from '../permissions'
import { useTimeOffStore } from '../store'
import { STATUS_LABELS } from '../model'
import type { TimeOffRequest } from '../model'
import { formatAmount } from '../logic'
import TimeOffListPage from '../components/list-page'
import TimeOffStatusBadge from '../components/status-badge'
import RequestActions from './actions'
import RequestContent from './content'
import RequestEditor from './editor'
import { requestPeriod } from './presentation'

type RequestRow = TimeOffRequest & { employeeName: string; avatar?: string; typeName: string; period: string }
const COLUMN_IDS = ['employeeName', 'typeName', 'period', 'duration', 'status']
const csvSafe = (value: string) => (/^\s*[=+\-@]/.test(value) ? "'" + value : value)

export default function RequestsView() {
  const { employees } = useEmployeeOptions()
  const requests = useTimeOffStore(state => state.requests)
  const types = useTimeOffStore(state => state.types)
  const { canCreateAny } = useTimeOffPermissions()
  const [employeeId, setEmployeeId] = useQueryState(
    'employee',
    parseAsString.withOptions({ history: 'push', shallow: true })
  )
  const [typeId, setTypeId] = useQueryState('type', parseAsString.withOptions({ history: 'push', shallow: true }))
  const [recordId, setRecordId] = useQueryState('record', parseAsString.withOptions({ history: 'push', shallow: true }))
  const [editor, setEditor] = useState<TimeOffRequest | 'new' | null>(null)
  const selected = requests.find(request => request.id === recordId)
  const data = useMemo<RequestRow[]>(
    () =>
      requests
        .filter(request => (!employeeId || request.employeeId === employeeId) && (!typeId || request.typeId === typeId))
        .map(request => {
          const employee = employees.find(employee => employee.id === request.employeeId)
          return {
            ...request,
            employeeName: employee ? employee.name : 'Employee unavailable',
            typeName: types.find(type => type.id === request.typeId)?.name || 'Type unavailable',
            period: requestPeriod(request)
          }
        }),
    [requests, employees, types, employeeId, typeId]
  )
  const columns = useMemo<ColumnDef<RequestRow>[]>(
    () => [
      {
        accessorKey: 'employeeName',
        size: 205,
        meta: { label: 'Employee', icon: UsersIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Employee' />,
        cell: ({ row }) => (
          <span className='flex min-w-0 items-center gap-2'>
            <PersonAvatar name={row.original.employeeName} src={row.original.avatar} className='size-6' />
            <span className='truncate'>{row.original.employeeName}</span>
          </span>
        )
      },
      {
        accessorKey: 'typeName',
        size: 165,
        meta: { label: 'Time off type', icon: FileTextIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Time off type' />
      },
      {
        accessorKey: 'period',
        size: 265,
        meta: { label: 'Dates', icon: CalendarIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Dates' />,
        sortingFn: (a, b) =>
          a.original.startDate.localeCompare(b.original.startDate) ||
          a.original.startTime.localeCompare(b.original.startTime),
        cell: ({ row }) => <span className='tabular-nums'>{row.original.period}</span>
      },
      {
        accessorKey: 'duration',
        size: 115,
        meta: { label: 'Duration', icon: ClockIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Duration' />,
        cell: ({ row }) => (
          <span className='tabular-nums'>{formatAmount(row.original.duration, row.original.unit)}</span>
        )
      },
      {
        accessorKey: 'status',
        size: 170,
        meta: {
          label: 'Status',
          icon: CircleCheckIcon,
          filterOptions: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        filterFn: (row, id, value) => row.getValue(id) === value,
        cell: ({ row }) => <TimeOffStatusBadge status={row.original.status} />
      }
    ],
    []
  )
  return (
    <>
      <TimeOffListPage
        title='Requests'
        noun={'request'}
        icon={CalendarDaysIcon}
        data={data}
        columns={columns}
        columnIds={COLUMN_IDS}
        showFilterFieldLabels={false}
        onOpen={record => setRecordId(record.id)}
        actions={
          canCreateAny ? (
            <Button size='sm' className={ACCENT_ICON_BUTTON} onClick={() => setEditor('new')}>
              <PlusIcon />
              <span className='max-sm:hidden'>New request</span>
              <span className='sr-only sm:hidden'>New request</span>
            </Button>
          ) : undefined
        }
        filters={
          <>
            <div className='grid w-full gap-1.5 sm:w-52'>
              <label htmlFor='requests-employee-scope' className='text-muted-foreground text-xs'>
                Employee
              </label>
              <Choice
                id='requests-employee-scope'
                value={employeeId || 'all'}
                options={[
                  { value: 'all', label: 'All employees' },
                  ...employees.map(employee => ({ value: employee.id, label: employee.name }))
                ]}
                onChange={value => setEmployeeId(value === 'all' ? null : value)}
              />
            </div>
            <div className='grid w-full gap-1.5 sm:w-48'>
              <label htmlFor='requests-type-scope' className='text-muted-foreground text-xs'>
                Time off type
              </label>
              <Choice
                id='requests-type-scope'
                value={typeId || 'all'}
                options={[
                  { value: 'all', label: 'All types' },
                  ...types.map(type => ({ value: type.id, label: type.name }))
                ]}
                onChange={value => setTypeId(value === 'all' ? null : value)}
              />
            </div>
            {(employeeId || typeId) && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => {
                  setEmployeeId(null)
                  setTypeId(null)
                }}
              >
                <XIcon />
                Clear scope
              </Button>
            )}
          </>
        }
        onExport={rows =>
          downloadCsv(
            'time-off-requests.csv',
            rows.map(request => ({
              Employee: csvSafe(request.employeeName),
              Type: csvSafe(request.typeName),
              Dates: csvSafe(request.period),
              'Start date': request.startDate,
              'End date': request.endDate,
              Duration: request.duration,
              Unit: request.unit,
              Status: STATUS_LABELS[request.status],
              Reason: csvSafe(request.reason)
            }))
          )
        }
      />
      <RecordPanel
        title='Time off request'
        open={!!selected}
        onClose={() => setRecordId(null)}
        href={selected ? `/time-off/requests/${selected.id}` : undefined}
      >
        {selected && (
          <>
            <RequestContent key={selected.id} record={selected} />
            <div className='mt-4'>
              <RequestActions
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
        <RequestEditor
          record={editor === 'new' ? undefined : editor}
          employeeId={employeeId || undefined}
          typeId={typeId || undefined}
          onClose={() => setEditor(null)}
          onSaved={id => {
            // The editor awaits the save before calling back, so the store already holds the
            // record; reading it synchronously here no longer races the mutation.
            const saved = useTimeOffStore.getState().requests.find(request => request.id === id)
            if (saved && employeeId) setEmployeeId(saved.employeeId)
            if (saved && typeId) setTypeId(saved.typeId)
            setRecordId(id)
          }}
        />
      )}
    </>
  )
}
