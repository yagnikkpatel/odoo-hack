'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CalendarDaysIcon, CircleCheckIcon, ClockIcon, PlusIcon, UserIcon, WalletIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { downloadCsv } from '@/features/nexacrm/utils/csv'
import { Choice, FormField } from '@/features/hr/components/form'
import RecordPanel from '@/features/hr/components/record-panel'
import { useEmployeesStore } from '@/features/employees/store'
import { employeeName } from '@/features/employees/types'
import TimeOffListPage from '../components/list-page'
import TimeOffStatusBadge from '../components/status-badge'
import { STATUS_LABELS } from '../model'
import type { Allocation, LeaveUnit } from '../model'
import { allocationBalance, formatAmount } from '../logic'
import { useTimeOffStore } from '../store'
import AllocationEditor from './editor'
import AllocationActions from './actions'
import AllocationContent, { displayDate } from './content'

type AllocationRow = Allocation & {
  employeeName: string
  avatar?: string
  typeName: string
  unit: LeaveUnit
  taken: number
  remaining: number
}
const COLUMN_IDS = ['employeeName', 'typeName', 'amount', 'taken', 'remaining', 'validFrom', 'validTo', 'status']
const csvSafe = (value: string) => (/^\s*[=+\-@]/.test(value) ? "'" + value : value)

export default function AllocationsView() {
  const types = useTimeOffStore(state => state.types)
  const allocations = useTimeOffStore(state => state.allocations)
  const requests = useTimeOffStore(state => state.requests)
  const employees = useEmployeesStore(state => state.employees)
  const { can } = useCurrentUser()
  const [editor, setEditor] = useState<Allocation | 'new' | null>(null)
  const [record, setRecord] = useQueryState('record', parseAsString.withOptions({ history: 'push', shallow: true }))
  const [employeeId, setEmployeeId] = useQueryState(
    'employee',
    parseAsString.withDefault('').withOptions({ history: 'push', shallow: true })
  )
  const [typeId, setTypeId] = useQueryState(
    'type',
    parseAsString.withDefault('').withOptions({ history: 'push', shallow: true })
  )
  const selected = allocations.find(allocation => allocation.id === record)
  const data = useMemo<AllocationRow[]>(
    () =>
      allocations
        .filter(
          allocation =>
            (!employeeId || allocation.employeeId === employeeId) && (!typeId || allocation.typeId === typeId)
        )
        .map(allocation => {
          const employee = employees.find(item => item.id === allocation.employeeId)
          const type = types.find(item => item.id === allocation.typeId)
          const balance = allocationBalance({ types, allocations, requests }, allocation.id)
          return {
            ...allocation,
            employeeName: employee ? employeeName(employee) : 'Employee unavailable',
            avatar: employee?.avatar,
            typeName: type?.name ?? 'Type unavailable',
            unit: type?.unit ?? 'days',
            taken: balance.taken,
            remaining: balance.remaining
          }
        }),
    [allocations, types, requests, employees, employeeId, typeId]
  )
  const columns = useMemo<ColumnDef<AllocationRow>[]>(
    () => [
      {
        accessorKey: 'employeeName',
        size: 235,
        meta: { label: 'Employee', icon: UserIcon, textFilter: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Employee' />,
        cell: ({ row }) => (
          <div className='flex min-w-0 items-center gap-2'>
            <PersonAvatar name={row.original.employeeName} src={row.original.avatar} className='size-6' />
            <span className='truncate font-medium'>{row.original.employeeName}</span>
          </div>
        )
      },
      {
        accessorKey: 'typeName',
        size: 170,
        meta: {
          label: 'Time off type',
          icon: CalendarDaysIcon,
          filterOptions: types.map(type => ({ value: type.name, label: type.name }))
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Time off type' />,
        filterFn: (row, id, value) => row.getValue(id) === value
      },
      {
        accessorKey: 'amount',
        size: 130,
        meta: { label: 'Granted', icon: WalletIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Granted' />,
        cell: ({ row }) => <span className='tabular-nums'>{formatAmount(row.original.amount, row.original.unit)}</span>
      },
      {
        accessorKey: 'taken',
        size: 120,
        meta: { label: 'Taken', icon: ClockIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Taken' />,
        cell: ({ row }) => <span className='tabular-nums'>{formatAmount(row.original.taken, row.original.unit)}</span>
      },
      {
        accessorKey: 'remaining',
        size: 135,
        meta: { label: 'Remaining', icon: WalletIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Remaining' />,
        cell: ({ row }) => (
          <span className='font-medium tabular-nums'>{formatAmount(row.original.remaining, row.original.unit)}</span>
        )
      },
      {
        accessorKey: 'validFrom',
        size: 140,
        meta: { label: 'Valid from', icon: CalendarDaysIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Valid from' />,
        cell: ({ row }) => displayDate(row.original.validFrom)
      },
      {
        accessorKey: 'validTo',
        size: 140,
        meta: { label: 'Valid until', icon: CalendarDaysIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Valid until' />,
        cell: ({ row }) => displayDate(row.original.validTo)
      },
      {
        accessorKey: 'status',
        size: 155,
        meta: {
          label: 'Status',
          icon: CircleCheckIcon,
          filterOptions: ['pending', 'approved', 'refused'].map(value => ({
            value,
            label: STATUS_LABELS[value as Allocation['status']]
          }))
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        filterFn: (row, id, value) => row.getValue(id) === value,
        cell: ({ row }) => <TimeOffStatusBadge status={row.original.status} />
      },
      {
        id: 'actions',
        size: 48,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        header: () => <span className='sr-only'>Actions</span>,
        cell: ({ row }) => (
          <AllocationActions
            allocation={row.original}
            onEdit={() => setEditor(row.original)}
            onDeleted={() => setRecord(null)}
          />
        )
      }
    ],
    [types, setRecord]
  )
  return (
    <>
      <TimeOffListPage
        title='Allocations'
        icon={WalletIcon}
        data={data}
        columns={columns}
        columnIds={COLUMN_IDS}
        onOpen={allocation => setRecord(allocation.id)}
        actions={
          can('records:create') ? (
            <Button size='sm' className={ACCENT_ICON_BUTTON} onClick={() => setEditor('new')}>
              <PlusIcon />
              <span className='max-sm:hidden'>New allocation</span>
              <span className='sr-only sm:hidden'>New allocation</span>
            </Button>
          ) : undefined
        }
        filters={
          <div className='flex flex-wrap items-end gap-3'>
            <div className='w-full sm:w-56'>
              <FormField id='allocation-filter-employee' label='Employee'>
                <Choice
                  id='allocation-filter-employee'
                  value={employeeId || 'all'}
                  options={[
                    { value: 'all', label: 'All employees' },
                    ...employees.map(employee => ({ value: employee.id, label: employeeName(employee) }))
                  ]}
                  onChange={value => setEmployeeId(value === 'all' ? '' : value)}
                />
              </FormField>
            </div>
            <div className='w-full sm:w-52'>
              <FormField id='allocation-filter-type' label='Time off type'>
                <Choice
                  id='allocation-filter-type'
                  value={typeId || 'all'}
                  options={[
                    { value: 'all', label: 'All time off types' },
                    ...types.map(type => ({ value: type.id, label: type.name }))
                  ]}
                  onChange={value => setTypeId(value === 'all' ? '' : value)}
                />
              </FormField>
            </div>
            {(employeeId || typeId) && (
              <Button
                size='sm'
                variant='ghost'
                onClick={() => {
                  setEmployeeId('')
                  setTypeId('')
                }}
              >
                Clear scope
              </Button>
            )}
          </div>
        }
        onExport={rows =>
          downloadCsv(
            'time-off-allocations.csv',
            rows.map(allocation => ({
              Employee: csvSafe(allocation.employeeName),
              Type: csvSafe(allocation.typeName),
              Granted: allocation.amount,
              Taken: allocation.taken,
              Remaining: allocation.remaining,
              Unit: allocation.unit,
              'Valid from': allocation.validFrom,
              'Valid until': allocation.validTo || 'No expiry',
              Status: STATUS_LABELS[allocation.status]
            }))
          )
        }
      />
      <RecordPanel
        title='Allocation details'
        open={!!selected}
        onClose={() => setRecord(null)}
        href={selected ? '/time-off/allocations/' + selected.id : undefined}
        actions={
          selected ? (
            <AllocationActions
              allocation={selected}
              onEdit={() => setEditor(selected)}
              onDeleted={() => setRecord(null)}
            />
          ) : undefined
        }
      >
        {selected && <AllocationContent allocation={selected} />}
      </RecordPanel>
      {editor && (
        <AllocationEditor
          allocation={editor === 'new' ? undefined : editor}
          employeeId={employeeId}
          typeId={typeId}
          onClose={() => setEditor(null)}
          onSaved={setRecord}
        />
      )}
    </>
  )
}
