'use client'

import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { BuildingIcon, CalendarIcon, CircleCheckIcon, CoinsIcon, FileDownIcon, TimerIcon, UserIcon } from 'lucide-react'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import { money, type Payslip } from '../types'
import { PayslipPdfButton, Status } from './shared'

/** Columns the operator may reorder or hide - `select` and `pdf` are fixed. */
export const PAYSLIP_COLUMN_IDS = ['employeeName', 'period', 'structureName', 'status', 'workedDays', 'basic', 'gross', 'net']

export const PAYSLIP_COLUMN_ORDER = ['select', ...PAYSLIP_COLUMN_IDS, 'pdf']

export const payslipColumns: ColumnDef<Payslip>[] = [
  {
    id: 'select',
    size: 44,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableGlobalFilter: false,
    header: ({ table }) => (
      <div className="flex justify-center">
        <Checkbox
          aria-label="Select all"
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
        />
      </div>
    ),
    cell: ({ row }) => (
      // The row itself is not clickable, but keep the click off any parent handler added later.
      <div className="flex justify-center" onClick={event => event.stopPropagation()}>
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
        />
      </div>
    ),
  },
  {
    accessorKey: 'employeeName',
    size: 220,
    meta: { label: 'Employee', icon: UserIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Employee" />,
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-2">
        <Link
          className="truncate font-medium hover:underline"
          href={`/payslips/${row.original.id}`}
          onClick={event => event.stopPropagation()}
        >
          {row.original.employeeName}
        </Link>
        {row.original.warnings.length > 0 && (
          <span className="shrink-0 text-xs text-amber-700">
            {row.original.warnings.length} warning{row.original.warnings.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    ),
  },
  {
    id: 'period',
    accessorFn: slip => slip.startDate,
    size: 190,
    meta: { label: 'Period', icon: CalendarIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Period" />,
    cell: ({ row }) => `${row.original.startDate} – ${row.original.endDate}`,
  },
  {
    accessorKey: 'structureName',
    size: 170,
    meta: { label: 'Structure', icon: BuildingIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Structure" />,
  },
  {
    accessorKey: 'status',
    size: 130,
    meta: { label: 'Status', icon: CircleCheckIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    filterFn: (row, id, value) => row.getValue(id) === value,
    cell: ({ row }) => <Status status={row.original.status} />,
  },
  {
    id: 'workedDays',
    accessorFn: slip => slip.workedDays,
    size: 130,
    meta: { label: 'Worked days', icon: TimerIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Worked days" />,
    cell: ({ row }) => (
      <span className="tabular-nums">
        {row.original.workedDays} / {row.original.expectedDays}
      </span>
    ),
  },
  {
    accessorKey: 'basic',
    size: 130,
    meta: { label: 'Basic', icon: CoinsIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Basic" />,
    cell: ({ row }) => <span className="tabular-nums">{money(row.original.basic, row.original.currency)}</span>,
  },
  {
    accessorKey: 'gross',
    size: 130,
    meta: { label: 'Gross', icon: CoinsIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Gross" />,
    cell: ({ row }) => <span className="tabular-nums">{money(row.original.gross, row.original.currency)}</span>,
  },
  {
    accessorKey: 'net',
    size: 130,
    meta: { label: 'Net', icon: CoinsIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Net" />,
    cell: ({ row }) => (
      <span className="font-medium tabular-nums">{money(row.original.net, row.original.currency)}</span>
    ),
  },
  {
    id: 'pdf',
    size: 90,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableGlobalFilter: false,
    meta: { label: 'PDF', icon: FileDownIcon },
    header: () => <span className="sr-only">PDF</span>,
    cell: ({ row }) => <PayslipPdfButton slip={row.original} />,
  },
]
