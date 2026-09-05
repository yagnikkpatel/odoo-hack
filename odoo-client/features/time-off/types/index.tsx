'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { CalendarDaysIcon, CheckCircleIcon, HashIcon, PlusIcon, ShieldCheckIcon, WalletIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { downloadCsv } from '@/features/nexacrm/utils/csv'
import RecordPanel from '@/features/hr/components/record-panel'
import TimeOffListPage from '../components/list-page'
import { APPROVAL_LABELS, PAYROLL_LABELS, UNIT_LABELS } from '../model'
import type { TimeOffType } from '../model'
import { useTimeOffPermissions } from '../permissions'
import { useTimeOffStore } from '../store'
import TypeEditor from './editor'
import TypeActions from './actions'
import TypeContent from './content'

const COLUMN_IDS = ['name', 'code', 'unit', 'requiresAllocation', 'approval', 'payroll', 'active']
const csvSafe = (value: string) => (/^\s*[=+\-@]/.test(value) ? "'" + value : value)

export default function TypesView() {
  const types = useTimeOffStore(state => state.types)
  const { canManageTypes } = useTimeOffPermissions()
  const [editor, setEditor] = useState<TimeOffType | 'new' | null>(null)
  const [record, setRecord] = useQueryState('record', parseAsString.withOptions({ history: 'push', shallow: true }))
  const selected = types.find(type => type.id === record)
  const columns = useMemo<ColumnDef<TimeOffType>[]>(
    () => [
      {
        accessorKey: 'name',
        size: 230,
        meta: { label: 'Time off type', icon: CalendarDaysIcon, textFilter: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Time off type' />,
        cell: ({ row }) => <span className='font-medium'>{row.original.name}</span>
      },
      {
        accessorKey: 'code',
        size: 120,
        meta: { label: 'Code', icon: HashIcon, textFilter: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Code' />,
        cell: ({ row }) => <Badge variant='outline'>{row.original.code}</Badge>
      },
      {
        accessorKey: 'unit',
        size: 95,
        meta: {
          label: 'Unit',
          icon: CalendarDaysIcon,
          filterOptions: Object.entries(UNIT_LABELS).map(([value, label]) => ({ value, label }))
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Unit' />,
        filterFn: (row, id, value) => row.getValue(id) === value,
        cell: ({ row }) => UNIT_LABELS[row.original.unit]
      },
      {
        id: 'requiresAllocation',
        accessorFn: type => (type.requiresAllocation ? 'Required' : 'Not required'),
        size: 150,
        meta: {
          label: 'Allocation',
          icon: WalletIcon,
          filterOptions: [
            { value: 'Required', label: 'Required' },
            { value: 'Not required', label: 'Not required' }
          ]
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Allocation' />,
        filterFn: (row, id, value) => row.getValue(id) === value
      },
      {
        accessorKey: 'approval',
        size: 185,
        meta: {
          label: 'Approval',
          icon: ShieldCheckIcon,
          filterOptions: Object.entries(APPROVAL_LABELS).map(([value, label]) => ({ value, label }))
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Approval' />,
        filterFn: (row, id, value) => row.getValue(id) === value,
        cell: ({ row }) => APPROVAL_LABELS[row.original.approval]
      },
      {
        accessorKey: 'payroll',
        size: 130,
        meta: {
          label: 'Payroll',
          icon: WalletIcon,
          filterOptions: Object.entries(PAYROLL_LABELS).map(([value, label]) => ({ value, label }))
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Payroll' />,
        filterFn: (row, id, value) => row.getValue(id) === value,
        cell: ({ row }) => PAYROLL_LABELS[row.original.payroll]
      },
      {
        id: 'active',
        accessorFn: type => (type.active ? 'Active' : 'Archived'),
        size: 110,
        meta: {
          label: 'Status',
          icon: CheckCircleIcon,
          filterOptions: [
            { value: 'Active', label: 'Active' },
            { value: 'Archived', label: 'Archived' }
          ]
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        filterFn: (row, id, value) => row.getValue(id) === value,
        cell: ({ row }) => (
          <Badge variant={row.original.active ? 'secondary' : 'outline'}>
            {row.original.active ? 'Active' : 'Archived'}
          </Badge>
        )
      },
      {
        id: 'actions',
        size: 48,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        header: () => <span className='sr-only'>Actions</span>,
        cell: ({ row }) => (
          <TypeActions type={row.original} onEdit={() => setEditor(row.original)} onDeleted={() => setRecord(null)} />
        )
      }
    ],
    [setRecord]
  )
  return (
    <>
      <TimeOffListPage
        title='Time off types'
        icon={CalendarDaysIcon}
        data={types}
        columns={columns}
        columnIds={COLUMN_IDS}
        onOpen={type => setRecord(type.id)}
        actions={
          canManageTypes ? (
            <Button size='sm' className={ACCENT_ICON_BUTTON} onClick={() => setEditor('new')}>
              <PlusIcon />
              <span className='max-sm:hidden'>New type</span>
              <span className='sr-only sm:hidden'>New type</span>
            </Button>
          ) : undefined
        }
        onExport={rows =>
          downloadCsv(
            'time-off-types.csv',
            rows.map(type => ({
              Name: csvSafe(type.name),
              Code: csvSafe(type.code),
              Unit: UNIT_LABELS[type.unit],
              Allocation: type.requiresAllocation ? 'Required' : 'Not required',
              Approval: APPROVAL_LABELS[type.approval],
              Payroll: PAYROLL_LABELS[type.payroll],
              Status: type.active ? 'Active' : 'Archived'
            }))
          )
        }
      />
      <RecordPanel
        title='Time off type details'
        open={!!selected}
        onClose={() => setRecord(null)}
        href={selected ? '/time-off/types/' + selected.id : undefined}
        actions={
          selected ? (
            <TypeActions type={selected} onEdit={() => setEditor(selected)} onDeleted={() => setRecord(null)} />
          ) : undefined
        }
      >
        {selected && <TypeContent type={selected} />}
      </RecordPanel>
      {editor && (
        <TypeEditor type={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={setRecord} />
      )}
    </>
  )
}
