'use client'
import type { ColumnDef } from '@tanstack/react-table'
import {
  CalendarIcon,
  CoinsIcon,
  FileTextIcon,
  UsersIcon,
  CircleCheckIcon,
  BuildingIcon,
  BriefcaseIcon,
} from 'lucide-react'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import ContractActions from '../components/contract-actions'
import ContractStatusBadge from '../components/status-badge'
import { formatContractDate, formatWage } from '../types'
import type { ContractRow } from '../types'

export const REORDERABLE_COLUMN_IDS = [
  'employeeName',
  'name',
  'startDate',
  'endDate',
  'wage',
  'status',
  'department',
  'jobPosition',
  'salaryStructure',
]
export const INITIAL_COLUMN_ORDER = [
  'select',
  ...REORDERABLE_COLUMN_IDS,
  'actions',
]
export const columns: ColumnDef<ContractRow>[] = [
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
    size: 200,
    meta: { label: 'Employee', icon: UsersIcon, textFilter: true },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Employee" />
    ),
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <PersonAvatar
          name={row.original.employeeName}
          src={row.original.avatar}
          className="size-6"
        />
        <span className="truncate">{row.original.employeeName}</span>
      </span>
    ),
  },
  {
    accessorKey: 'name',
    size: 215,
    meta: { label: 'Contract', icon: FileTextIcon, textFilter: true },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Contract" />
    ),
    cell: ({ row }) => (
      <span className="block truncate font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: 'startDate',
    size: 125,
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
    size: 125,
    meta: { label: 'End date', icon: CalendarIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="End date" />
    ),
    cell: ({ row }) => (
      <span
        className={
          row.original.endDate ? 'tabular-nums' : 'text-muted-foreground'
        }
      >
        {formatContractDate(row.original.endDate)}
      </span>
    ),
  },
  {
    accessorKey: 'wage',
    size: 170,
    meta: { label: 'Wage', icon: CoinsIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Wage" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums">{formatWage(row.original)}</span>
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
    filterFn: (row, id, value) => row.getValue(id) === value,
  },
  {
    accessorKey: 'department',
    size: 170,
    meta: { label: 'Department', icon: BuildingIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Department" />
    ),
    filterFn: (row, id, value) => row.getValue(id) === value,
  },
  {
    accessorKey: 'jobPosition',
    size: 190,
    meta: { label: 'Job position', icon: BriefcaseIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Job position" />
    ),
  },
  {
    accessorKey: 'salaryStructure',
    size: 170,
    meta: { label: 'Salary structure', icon: FileTextIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Salary structure" />
    ),
    filterFn: (row, id, value) => row.getValue(id) === value,
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
