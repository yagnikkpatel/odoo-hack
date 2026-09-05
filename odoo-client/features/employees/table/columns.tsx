'use client'

import type { ColumnDef } from '@tanstack/react-table'
import {
  BriefcaseIcon, Building2Icon, CircleCheckIcon, MailIcon,
  PhoneIcon, ShieldIcon, UserIcon, UsersIcon,
} from 'lucide-react'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import { ROLE_LABELS } from '@/features/nexacrm/types/rbac-types'
import { employeeName } from '../types'
import type { Employee } from '../types'
import EmployeeCompany from '../components/employee-company'
import EmployeeStatusBadge from '../components/status-badge'
import EmployeeRowActions from './row-actions'

export const REORDERABLE_COLUMN_IDS = [
  'name', 'email', 'companyName', 'department', 'jobTitle',
  'managerName', 'status', 'role', 'phone',
]
export const INITIAL_COLUMN_ORDER = ['select', ...REORDERABLE_COLUMN_IDS, 'actions']

function TextCell({ value }: { value?: string }) {
  if (!value) return <span className="text-muted-foreground">Not set</span>
  return <span className="block truncate">{value}</span>
}

export const columns: ColumnDef<Employee>[] = [
  {
    id: 'select',
    size: 44,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableGlobalFilter: false,
    meta: { cellClassName: 'px-0' },
    header: ({ table }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all employees on this page"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label={'Select ' + employeeName(row.original)}
        />
      </div>
    ),
  },
  {
    id: 'name',
    size: 210,
    accessorFn: employeeName,
    meta: { label: 'Name', icon: UsersIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
    cell: ({ row }) => (
      <span className="flex min-w-0 items-center gap-2">
        <PersonAvatar name={employeeName(row.original)} src={row.original.avatar} className="size-6" />
        <span className="truncate">{employeeName(row.original)}</span>
      </span>
    ),
  },
  {
    accessorKey: 'email',
    size: 220,
    meta: { label: 'Work email', icon: MailIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Work email" />,
    cell: ({ row }) => {
      if (!row.original.email) return <TextCell />
      return (
        <a
          href={'mailto:' + row.original.email}
          className="text-primary block truncate hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.original.email}
        </a>
      )
    },
  },
  {
    accessorKey: 'companyName',
    size: 170,
    meta: { label: 'Company', icon: Building2Icon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Company" />,
    cell: ({ row }) => <EmployeeCompany employee={row.original} />,
  },
  {
    accessorKey: 'department',
    size: 160,
    meta: { label: 'Department', icon: Building2Icon, textFilter: true },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
    cell: ({ row }) => <TextCell value={row.original.department} />,
  },
  {
    accessorKey: 'jobTitle',
    size: 190,
    meta: { label: 'Job position', icon: BriefcaseIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Job position" />,
    cell: ({ row }) => <TextCell value={row.original.jobTitle} />,
  },
  {
    accessorKey: 'managerName',
    size: 170,
    meta: { label: 'Manager', icon: UserIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Manager" />,
    cell: ({ row }) => <TextCell value={row.original.managerName} />,
  },
  {
    accessorKey: 'status',
    size: 120,
    meta: { label: 'Status', icon: CircleCheckIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => <EmployeeStatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'role',
    size: 180,
    meta: {
      label: 'Role',
      icon: ShieldIcon,
      filterOptions: Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
    },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Role" />,
    cell: ({ row }) => {
      if (!row.original.role) return <TextCell />
      return <TextCell value={ROLE_LABELS[row.original.role]} />
    },
  },
  {
    accessorKey: 'phone',
    size: 170,
    meta: { label: 'Phone', icon: PhoneIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
    cell: ({ row }) => <TextCell value={row.original.phone} />,
  },
  {
    id: 'actions',
    size: 48,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableGlobalFilter: false,
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row, table }) => <EmployeeRowActions row={row} table={table} />,
  },
]
