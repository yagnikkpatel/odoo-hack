"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  CircleCheckIcon,
} from "lucide-react";
import AttendanceEmployeeAvatar from "./employee-avatar";
import { Badge } from "@/features/nexacrm/components/ui/badge";
import { ATTENDANCE_STATUSES, dateTimeLabel, hoursLabel } from "./types";
import type { Attendance } from "./types";
import AttendanceStatusBadge from "./status-badge";
import AttendanceActions from "./record-actions";

export const ATTENDANCE_COLUMNS = [
  "employeeName",
  "attendanceDate",
  "checkIn",
  "checkOut",
  "workedHours",
  "overtimeHours",
  "status",
];

export function attendanceColumns(
  onEdit: (record: Attendance) => void,
): ColumnDef<Attendance>[] {
  return [
    {
      accessorKey: "employeeName",
      size: 210,
      meta: { label: "Employee", icon: UsersIcon },
      header: "Employee",
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-2">
          <AttendanceEmployeeAvatar employeeId={row.original.employeeId} name={row.original.employeeName} />
          <span className="truncate">{row.original.employeeName}</span>
        </span>
      ),
    },
    {
      accessorKey: "attendanceDate",
      size: 140,
      meta: { label: "Attendance date", icon: CalendarIcon },
      header: "Attendance date",
    },
    ...(["checkIn", "checkOut"] as const).map((key): ColumnDef<Attendance> => ({
      accessorKey: key,
      size: 190,
      meta: {
        label: key === "checkIn" ? "Check in (IST)" : "Check out (IST)",
        icon: CalendarIcon,
      },
      header: key === "checkIn" ? "Check in (IST)" : "Check out (IST)",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original[key] ? dateTimeLabel(row.original[key]) : "—"}
        </span>
      ),
    })),
    ...(["workedHours", "overtimeHours"] as const).map(
      (key): ColumnDef<Attendance> => ({
        accessorKey: key,
        size: 145,
        meta: {
          label: key === "workedHours" ? "Worked hours" : "Overtime",
          icon: ClockIcon,
        },
        header: key === "workedHours" ? "Worked hours" : "Overtime",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {hoursLabel(row.original[key] * 60)}
          </span>
        ),
      }),
    ),
    {
      accessorKey: "status",
      size: 180,
      meta: {
        label: "Status",
        icon: CircleCheckIcon,
        filterOptions: Object.entries(ATTENDANCE_STATUSES).map(
          ([value, label]) => ({ value, label }),
        ),
      },
      header: "Status",
      cell: ({ row }) => (
        <span className="flex items-center gap-1">
          <AttendanceStatusBadge status={row.original.status} />
          {row.original.editedAt && <Badge variant="outline">Edited</Badge>}
        </span>
      ),
    },
    {
      id: "actions",
      size: 48,
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
  ];
}
