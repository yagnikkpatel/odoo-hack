'use client'

import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import {
  CalendarIcon,
  CircleCheckIcon,
  CoinsIcon,
  LayersIcon,
  PlusIcon,
  TriangleAlertIcon,
  UsersIcon,
  WalletIcon
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import RecordPanel from '@/features/hr/components/record-panel'
import { usePayrollPermissions } from '../permissions'
import { usePayrollStore } from '../store'
import { PAYRUN_STATUSES, formatPeriod, formatTimestamp, isLocked, money } from '../types'
import type { Payrun } from '../types'
import PayrollListPage, { AccessDenied } from '../components/list-page'
import PayrollStatusBadge from '../components/status-badge'
import PayrunWizard from './wizard'

type PayrunRow = Payrun & { period: string }
const COLUMN_IDS = ['name', 'structureName', 'period', 'payslipCount', 'totalNet', 'status']

export default function PayrunsView() {
  const payruns = usePayrollStore(state => state.payruns)
  const { canRead, canProcess, canDelete } = usePayrollPermissions()
  const [recordId, setRecordId] = useQueryState('record', parseAsString.withOptions({ history: 'push', shallow: true }))
  const [creating, setCreating] = useState(false)
  const selected = payruns.find(run => run.id === recordId)
  const data = useMemo<PayrunRow[]>(
    () => payruns.map(run => ({ ...run, period: formatPeriod(run.startDate, run.endDate) })),
    [payruns]
  )
  const columns = useMemo<ColumnDef<PayrunRow>[]>(
    () => [
      {
        accessorKey: 'name',
        size: 220,
        meta: { label: 'Run name', icon: WalletIcon, textFilter: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Run name' />,
        cell: ({ row }) => (
          <span className='flex min-w-0 items-center gap-2'>
            <span className='truncate font-medium'>{row.original.name}</span>
            {row.original.blockingCount > 0 && (
              <TriangleAlertIcon className='size-3.5 shrink-0 text-amber-600' aria-label='Has blocking warnings' />
            )}
          </span>
        )
      },
      {
        accessorKey: 'structureName',
        size: 190,
        meta: { label: 'Salary structure', icon: LayersIcon, textFilter: true },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Salary structure' />
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
        accessorKey: 'payslipCount',
        size: 110,
        meta: { label: 'Employees', icon: UsersIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Employees' />,
        cell: ({ row }) => <span className='tabular-nums'>{row.original.payslipCount}</span>
      },
      {
        accessorKey: 'totalNet',
        size: 150,
        meta: { label: 'Total net', icon: CoinsIcon },
        header: ({ column }) => <DataTableColumnHeader column={column} title='Total net' />,
        cell: ({ row }) => (
          <span className='tabular-nums'>
            {row.original.status === 'draft' ? <span className='text-muted-foreground'>Not computed</span> : money(row.original.totalNet)}
          </span>
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
          <RowActionShell
            label={`Actions for ${row.original.name}`}
            viewHref={`/payroll/${row.original.id}`}
            onDelete={
              canDelete && !isLocked(row.original.status)
                ? async () => {
                    const result = await usePayrollStore.getState().removePayrun(row.original.id)
                    if (!result.ok) {
                      toast.error(result.error)
                      return
                    }
                    setRecordId(current => (current === row.original.id ? null : current))
                    toast.success('Payrun deleted')
                  }
                : undefined
            }
            deleteTitle='Delete payrun?'
            deleteDescription='This removes the unfinalized batch and its payslips. Validated and paid payroll cannot be deleted.'
          />
        )
      }
    ],
    [canDelete, setRecordId]
  )
  if (!canRead) return <AccessDenied />
  return (
    <>
      <PayrollListPage
        title='Payruns'
        icon={WalletIcon}
        data={data}
        columns={columns}
        columnIds={COLUMN_IDS}
        onOpen={row => setRecordId(row.id)}
        hint='Compute applies the salary structure to each employee’s period contract; validation locks the batch.'
        actions={
          canProcess ? (
            <Button size='sm' className={ACCENT_ICON_BUTTON} onClick={() => setCreating(true)}>
              <PlusIcon />
              <span className='max-sm:hidden'>New payrun</span>
              <span className='sr-only sm:hidden'>New payrun</span>
            </Button>
          ) : undefined
        }
      />
      <RecordPanel
        title='Payrun'
        open={!!selected}
        onClose={() => setRecordId(null)}
        href={selected ? `/payroll/${selected.id}` : undefined}
      >
        {selected && (
          <div className='space-y-4'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <p className='truncate font-medium'>{selected.name}</p>
                <p className='text-muted-foreground text-xs'>{formatPeriod(selected.startDate, selected.endDate)}</p>
              </div>
              <PayrollStatusBadge status={selected.status} />
            </div>
            <dl className='grid grid-cols-2 gap-x-4 gap-y-4 text-sm'>
              {[
                ['Salary structure', selected.structureName],
                ['Employees', String(selected.payslipCount)],
                ['Total gross', selected.status === 'draft' ? 'Not computed' : money(selected.totalGross)],
                ['Total net', selected.status === 'draft' ? 'Not computed' : money(selected.totalNet)],
                ['Warnings', selected.warningCount ? `${selected.warningCount} (${selected.blockingCount} blocking)` : 'None'],
                ['Created', `${formatTimestamp(selected.createdAt)}${selected.createdByName ? ` · ${selected.createdByName}` : ''}`]
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className='text-muted-foreground text-xs'>{label}</dt>
                  <dd className='mt-1 break-words tabular-nums'>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </RecordPanel>
      {creating && <PayrunWizard onClose={() => setCreating(false)} />}
    </>
  )
}
