'use client'

// Third-party Imports
import type { ColumnDef } from '@tanstack/react-table'
import {
  Building2Icon,
  CalendarIcon,
  BriefcaseIcon,
  LinkIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon
} from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { formatPersonName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import LinkedinCell from '@/features/nexacrm/components/record/linkedin-cell'
import OwnerCell from '@/features/nexacrm/components/record/owner-cell'

// Util Imports
import { formatDate } from '@/features/nexacrm/utils/format'

// Local Imports
import { CompanyRefCell, PersonNameCell, EmailCell } from '../people-cells'
import PersonRowActions from './row-actions'

export const REORDERABLE_COLUMN_IDS = [
  'name',
  'email',
  'jobTitle',
  'companyId',
  'phone',
  'city',
  'country',
  'linkedinUrl',
  'accountOwnerId',
  'createdById',
  'createdAt'
]

export const INITIAL_COLUMN_ORDER = ['select', ...REORDERABLE_COLUMN_IDS, 'actions']

export const columns: ColumnDef<Person>[] = [
  {
    id: 'select',
    size: 44,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableGlobalFilter: false,

    meta: { cellClassName: 'px-0' },
    header: ({ table }) => (
      <div className='flex items-center justify-center'>
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className='flex items-center justify-center'>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      </div>
    )
  },
  {
    id: 'name',
    size: 230,
    accessorFn: person => formatPersonName(person),
    meta: { label: 'Name', icon: UsersIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Name' />,
    cell: ({ row }) => <PersonNameCell person={row.original} />
  },
  {
    accessorKey: 'email',
    size: 230,
    meta: { label: 'Email', icon: MailIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Email' />,
    cell: ({ row }) => <EmailCell email={row.original.email} />
  },
  {
    accessorKey: 'jobTitle',
    size: 190,
    meta: { label: 'Job title', icon: BriefcaseIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Job title' />,
    cell: ({ row }) =>
      row.original.jobTitle ? (
        <span className='block max-w-50 truncate'>{row.original.jobTitle}</span>
      ) : (
        <span className='text-muted-foreground'>-</span>
      ),
    filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue
  },
  {
    accessorKey: 'companyId',
    size: 190,
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { label: 'Company', icon: Building2Icon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Company' />,
    cell: ({ row }) => <CompanyRefCell companyId={row.original.companyId} />,
    filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue
  },
  {
    accessorKey: 'phone',
    size: 170,
    enableSorting: false,
    meta: { label: 'Phone', icon: PhoneIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Phone' />,
    cell: ({ row }) =>
      row.original.phone ? (
        <span className='whitespace-nowrap tabular-nums'>{row.original.phone}</span>
      ) : (
        <span className='text-muted-foreground'>-</span>
      )
  },
  {
    accessorKey: 'city',
    size: 150,
    meta: { label: 'City', icon: MapPinIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='City' />,
    cell: ({ row }) =>
      row.original.city ? (
        <span className='truncate'>{row.original.city}</span>
      ) : (
        <span className='text-muted-foreground'>-</span>
      ),
    filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue
  },
  {
    accessorKey: 'country',
    size: 150,
    meta: { label: 'Country', icon: MapPinIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Country' />,
    cell: ({ row }) =>
      row.original.country ? (
        <span className='truncate'>{row.original.country}</span>
      ) : (
        <span className='text-muted-foreground'>-</span>
      ),
    filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue
  },
  {
    accessorKey: 'linkedinUrl',
    size: 150,
    meta: { label: 'LinkedIn', icon: LinkIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='LinkedIn' />,
    cell: ({ row }) => <LinkedinCell url={row.original.linkedinUrl} />
  },
  {
    accessorKey: 'createdById',
    size: 180,
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { label: 'Created by', icon: UserPlusIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Created by' />,
    cell: ({ row }) => <OwnerCell ownerId={row.original.createdById} />,
    filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue
  },
  {
    accessorKey: 'accountOwnerId',
    size: 180,
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { label: 'Account owner', icon: UserIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Account owner' />,
    cell: ({ row }) => <OwnerCell ownerId={row.original.accountOwnerId} />,
    filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue
  },
  {
    accessorKey: 'createdAt',
    size: 130,
    enableGlobalFilter: false,
    meta: { label: 'Created', icon: CalendarIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Created' />,
    cell: ({ row }) => (
      <span className='text-muted-foreground whitespace-nowrap'>{formatDate(row.original.createdAt)}</span>
    )
  },
  {
    id: 'actions',
    size: 48,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableGlobalFilter: false,
    header: () => <span className='sr-only'>Actions</span>,
    cell: ({ row, table }) => <PersonRowActions row={row} table={table} />
  }
]
