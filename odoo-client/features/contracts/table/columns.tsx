'use client'

import type { ColumnDef } from '@tanstack/react-table'
import {
  CalendarIcon,
  CircleCheckIcon,
  CoinsIcon,
  MailIcon,
  UsersIcon,
} from 'lucide-react'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import ContractActions from '../components/contract-actions'
import ContractStatusBadge from '../components/status-badge'
import { formatContractDate, formatWage } from '../types'
import type { Contract } from '../types'

export const REORDERABLE_COLUMN_IDS = [
  'employeeName',
  'employeeEmail',
  'startDate',
  'endDate',
  'wage',
  'status',
]

export const INITIAL_COLUMN_ORDER = [
  'select',
  ...REORDERABLE_COLUMN_IDS,
  'actions',
]

export const columns: ColumnDef<Contract>[] = [
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
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex justify-center">
        <Checkbox
          aria-label="Select row"
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
        />
      </div>
    ),
  },
  {
    accessorKey: 'employeeName',
    size: 220,
    meta: { label: 'Employee', icon: UsersIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Employee" />
    ),
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <PersonAvatar
          name={row.original.employeeName}
          src={row.original.employeeAvatar}
          className="size-6"
        />
        <span className="truncate font-medium">
          {row.original.employeeName}
        </span>
      </span>
    ),
  },
  {
    accessorKey: 'employeeEmail',
    size: 230,
    meta: { label: 'Email', icon: MailIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Email" />
    ),
    cell: ({ row }) => (
      <span className="block truncate">{row.original.employeeEmail}</span>
    ),
  },
  {
    accessorKey: 'startDate',
    size: 135,
    meta: { label: 'Start date', icon: CalendarIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Start date" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatContractDate(row.original.startDate)}
      </span>
    ),
  },
  {
    accessorKey: 'endDate',
    size: 135,
    meta: { label: 'End date', icon: CalendarIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="End date" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">
        {formatContractDate(row.original.endDate)}
      </span>
    ),
  },
  {
    accessorKey: 'wage',
    size: 155,
    meta: { label: 'Wage', icon: CoinsIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Wage" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{formatWage(row.original.wage)}</span>
    ),
  },
  {
    accessorKey: 'status',
    size: 125,
    meta: { label: 'Status', icon: CircleCheckIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <ContractStatusBadge status={row.original.status} />,
  },
  {
    id: 'actions',
    size: 48,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableGlobalFilter: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => (
      <ContractActions
        contract={row.original}
        onEdit={() => table.options.meta?.onEditRow?.(row.original)}
      />
    ),
  },
]
