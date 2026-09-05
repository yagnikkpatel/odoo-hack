'use client'

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import {
  BuildingIcon,
  CalendarIcon,
  CircleCheckIcon,
  CoinsIcon,
  FileTextIcon,
  UsersIcon,
  WalletIcon,
  XIcon
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'
import { Choice } from '@/features/hr/components/form'
import RecordPanel from '@/features/hr/components/record-panel'
import { usePayrollPermissions } from '../permissions'
import { usePayrollStore } from '../store'
import { PAYRUN_STATUSES, formatPeriod, money } from '../types'
import type { Payslip } from '../types'
import PayrollListPage, { AccessDenied } from '../components/list-page'
import PayrollStatusBadge from '../components/status-badge'
import PayslipContent from './payslip-content'

type PayslipRow = Payslip & { period: string }
const COLUMN_IDS = ['employeeName', 'payrunName', 'period', 'department', 'gross', 'net', 'status']

export default function PayslipsView() {
  const payslips = usePayrollStore(state => state.payslips)
  const payruns = usePayrollStore(state => state.payruns)
  const { canRead } = usePayrollPermissions()
  const [payrunId, setPayrunId] = useQueryState('payrun', parseAsString.withOptions({ history: 'push', shallow: true }))
  const [employeeId, setEmployeeId] = useQueryState('employee', parseAsString.withOptions({ history: 'push', shallow: true }))
  const [recordId, setRecordId] = useQueryState('record', parseAsString.withOptions({ history: 'push', shallow: true }))
  const selected = payslips.find(slip => slip.id === recordId)
  const data = useMemo<PayslipRow[]>(
    () =>
      payslips
        .filter(slip => (!payrunId || slip.payrunId === payrunId) && (!employeeId || slip.employeeId === employeeId))
        .map(slip => ({ ...slip, period: formatPeriod(slip.startDate, slip.endDate) })),
    [payslips, payrunId, employeeId]
  )
  const columns = useMemo<ColumnDef<PayslipRow>[]>(
    () => [
      {
        accessorKey: 'employeeName',
        size: 200,
        meta: { label: 'Employee', icon: UsersIcon, textFilter: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Employee' />,
        cell: ({ row }) => <span className='truncate font-medium'>{row.original.employeeName}</span>
      },
      {
        accessorKey: 'payrunName',
        size: 190,
        meta: { label: 'Payrun', icon: WalletIcon, textFilter: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Payrun' />
      },
      {
        accessorKey: 'period',
        size: 210,
        meta: { label: 'Period', icon: CalendarIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Period' />,
        sortingFn: (a, b) => a.original.startDate.localeCompare(b.original.startDate),
        cell: ({ row }) => <span className='tabular-nums'>{row.original.period}</span>
      },
      {
        accessorKey: 'department',
        size: 150,
        meta: { label: 'Department', icon: BuildingIcon, textFilter: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Department' />,
        cell: ({ row }) => row.original.department || <span className='text-muted-foreground'>Not set</span>
      },
      {
        accessorKey: 'gross',
        size: 140,
        meta: { label: 'Gross', icon: CoinsIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Gross' />,
        cell: ({ row }) => <span className='tabular-nums'>{row.original.status === 'draft' ? '—' : money(row.original.gross)}</span>
      },
      {
        accessorKey: 'net',
        size: 140,
        meta: { label: 'Net', icon: CoinsIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Net' />,
        cell: ({ row }) => (
          <span className='font-medium tabular-nums'>{row.original.status === 'draft' ? '—' : money(row.original.net)}</span>
        )
      },
      {
        accessorKey: 'status',
        size: 130,
        meta: {
          label: 'Status',
          icon: CircleCheckIcon,
          filterOptions: Object.entries(PAYRUN_STATUSES).map(([value, label]) => ({ value, label }))
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
        filterFn: (row, id, value) => row.getValue(id) === value,
        cell: ({ row }) => <PayrollStatusBadge status={row.original.status} />
      },
      {
        id: 'actions',
        size: 48,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        header: () => <span className='sr-only'>Actions</span>,
        cell: ({ row }) => (
          <RowActionShell label={`Actions for ${row.original.employeeName}`} viewHref={`/payslips/${row.original.id}`} />
        )
      }
    ],
    []
  )
  if (!canRead) return <AccessDenied />
  return (
    <>
      <PayrollListPage
        title='Payslips'
        icon={FileTextIcon}
        data={data}
        columns={columns}
        columnIds={COLUMN_IDS}
        onOpen={row => setRecordId(row.id)}
        filters={
          <>
            <div className='grid w-full gap-1.5 sm:w-56'>
              <label htmlFor='payslips-payrun-scope' className='text-muted-foreground text-xs'>
                Payrun
              </label>
              <Choice
                id='payslips-payrun-scope'
                value={payrunId || 'all'}
                options={[{ value: 'all', label: 'All payruns' }, ...payruns.map(run => ({ value: run.id, label: run.name }))]}
                onChange={value => setPayrunId(value === 'all' ? null : value)}
              />
            </div>
            {(payrunId || employeeId) && (
              <Button
                variant='ghost'
                size='sm'
                onClick={() => {
                  setPayrunId(null)
                  setEmployeeId(null)
                }}
              >
                <XIcon />
                Clear scope
              </Button>
            )}
          </>
        }
      />
      <RecordPanel
        title='Payslip'
        open={!!selected}
        onClose={() => setRecordId(null)}
        href={selected ? `/payslips/${selected.id}` : undefined}
      >
        {selected && <PayslipContent key={selected.id} slip={selected} compact />}
      </RecordPanel>
    </>
  )
}
