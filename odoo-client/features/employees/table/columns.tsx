'use client'
import type { ColumnDef } from '@tanstack/react-table'
import {
  BriefcaseIcon,
  Building2Icon,
  CircleCheckIcon,
  MailIcon,
  PhoneIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import {
  PersonNameCell,
  EmailCell,
} from '@/features/nexacrm/views/apps/people/people-cells'
import { useEmployeesStore } from '../store'
import { employeeName } from '../types'
import type { Employee } from '../types'
import EmployeeStatusBadge from '../components/status-badge'
import EmployeeRowActions from './row-actions'

export const REORDERABLE_COLUMN_IDS = [
  'name',
  'email',
  'department',
  'jobTitle',
  'managerId',
  'status',
  'phone',
]
export const INITIAL_COLUMN_ORDER = [
  'select',
  ...REORDERABLE_COLUMN_IDS,
  'actions',
]

function ManagerCell({ id }: { id?: string }) {
  const manager = useEmployeesStore((state) =>
    state.employees.find((employee) => employee.id === id),
  )
  return manager ? (
    <span className="flex min-w-0 items-center gap-2">
      <PersonAvatar
        name={employeeName(manager)}
        src={manager.avatar}
        className="size-5"
      />
      <span className="truncate">{employeeName(manager)}</span>
    </span>
  ) : (
    <span className="text-muted-foreground">Not assigned</span>
  )
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
          indeterminate={
            table.getIsSomePageRowsSelected() &&
            !table.getIsAllPageRowsSelected()
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      </div>
    ),
  },
  {
    id: 'name',
    size: 210,
    accessorFn: employeeName,
    meta: { label: 'Name', icon: UsersIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => <PersonNameCell person={row.original} />,
  },
  {
    accessorKey: 'email',
    size: 220,
    meta: { label: 'Work email', icon: MailIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Work email" />
    ),
    cell: ({ row }) => <EmailCell email={row.original.email} />,
  },
  {
    accessorKey: 'department',
    size: 160,
    meta: { label: 'Department', icon: Building2Icon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Department" />
    ),
    cell: ({ row }) => (
      <span className={row.original.department ? '' : 'text-muted-foreground'}>
        {row.original.department || 'Not set'}
      </span>
    ),
    filterFn: (row, id, value) => row.getValue(id) === value,
  },
  {
    accessorKey: 'jobTitle',
    size: 190,
    meta: { label: 'Job position', icon: BriefcaseIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Job position" />
    ),
    cell: ({ row }) => (
      <span className="block max-w-50 truncate">
        {row.original.jobTitle || '—'}
      </span>
    ),
    filterFn: (row, id, value) => row.getValue(id) === value,
  },
  {
    accessorKey: 'managerId',
    size: 170,
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { label: 'Manager', icon: UserIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Manager" />
    ),
    cell: ({ row }) => <ManagerCell id={row.original.managerId} />,
    filterFn: (row, id, value) => row.getValue(id) === value,
  },
  {
    accessorKey: 'status',
    size: 120,
    meta: { label: 'Status', icon: CircleCheckIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => <EmployeeStatusBadge status={row.original.status} />,
    filterFn: (row, id, value) => row.getValue(id) === value,
  },
  {
    accessorKey: 'phone',
    size: 170,
    enableSorting: false,
    meta: { label: 'Phone', icon: PhoneIcon },
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Phone" />
    ),
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums">
        {row.original.phone || '—'}
      </span>
    ),
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
