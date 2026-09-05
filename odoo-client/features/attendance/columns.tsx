'use client'
import type {
  ColumnDef,
  HeaderContext,
  CellContext,
} from '@tanstack/react-table'
import {
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  CircleCheckIcon,
} from 'lucide-react'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { ATTENDANCE_STATUSES, dateTimeLabel, hoursLabel } from './types'
import type { Attendance, AttendanceRow } from './types'
import AttendanceStatusBadge from './status-badge'
import AttendanceActions from './record-actions'

export const ATTENDANCE_COLUMNS = [
  'employeeName',
  'checkIn',
  'checkOut',
  'workedMinutes',
  'status',
]
export function attendanceColumns(
  onEdit: (record: Attendance) => void,
): ColumnDef<AttendanceRow>[] {
  return [
    {
      accessorKey: 'employeeName',
      size: 210,
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
    ...(['checkIn', 'checkOut'] as const).map((key) => ({
      accessorKey: key,
      size: 185,
      meta: {
        label: key === 'checkIn' ? 'Check in' : 'Check out',
        icon: CalendarIcon,
      },
      header: ({ column }: HeaderContext<AttendanceRow, unknown>) => (
        <DataTableColumnHeader
          column={column}
          title={key === 'checkIn' ? 'Check in' : 'Check out'}
        />
      ),
      cell: ({ row }: CellContext<AttendanceRow, unknown>) => (
        <span className="tabular-nums">{dateTimeLabel(row.original[key])}</span>
      ),
    })),
    {
      accessorKey: 'workedMinutes',
      size: 140,
      meta: { label: 'Worked hours', icon: ClockIcon },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Worked hours" />
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">
          {hoursLabel(row.original.workedMinutes)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      size: 185,
      meta: {
        label: 'Status',
        icon: CircleCheckIcon,
        filterOptions: Object.entries(ATTENDANCE_STATUSES).map(
          ([value, label]) => ({ value, label }),
        ),
      },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
      cell: ({ row }) => (
        <span className="flex items-center gap-1">
          <AttendanceStatusBadge status={row.original.status} />
          {row.original.corrections.length > 0 && (
            <Badge variant="outline">Edited</Badge>
          )}
        </span>
      ),
    },
    {
      id: 'actions',
      size: 48,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <AttendanceActions
          record={row.original}
          onEdit={() => onEdit(row.original)}
        />
      ),
    },
  ]
}
