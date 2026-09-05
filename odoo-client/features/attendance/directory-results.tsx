"use client";

import type { Table } from "@tanstack/react-table";
import { ClockIcon } from "lucide-react";
import { Card } from "@/features/nexacrm/components/ui/card";
import DataTable from "@/features/nexacrm/components/data-table/data-table";
import DataTableEmptyState from "@/features/nexacrm/components/data-table/data-table-empty-state";
import PersonAvatar from "@/features/nexacrm/components/record/person-avatar";
import { ATTENDANCE_COLUMNS } from "./columns";
import { dateTimeLabel, hoursLabel } from "./types";
import type { Attendance } from "./types";
import AttendanceStatusBadge from "./status-badge";
import RecordCalendar from "./record-calendar";
import AttendancePagination from "./attendance-pagination";

export default function AttendanceResults({
  table,
  loading,
  calendar,
  onOpen,
}: {
  table: Table<Attendance>;
  loading: boolean;
  calendar: boolean;
  onOpen: (id: string) => void;
}) {
  if (calendar)
    return (
      <div aria-busy={loading}>
        <RecordCalendar
          loading={loading}
          table={table}
          getId={(record) => record.id}
          getDate={(record) => record.attendanceDate + "T12:00:00"}
          getTitle={(record) => record.employeeName}
          getMeta={(record) =>
            record.checkIn ? dateTimeLabel(record.checkIn) : "No check-in"
          }
          onOpenRecord={(record) => onOpen(record.id)}
          testId="attendance-calendar"
          renderCard={(record) => (
            <button
              type="button"
              onClick={() => onOpen(record.id)}
              className="hover:bg-muted/50 flex w-full min-w-0 flex-col gap-2 rounded-lg border p-2.5 text-left focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="flex w-full min-w-0 items-center gap-2">
                <PersonAvatar name={record.employeeName} className="size-5!" />
                <span className="truncate text-xs font-medium">
                  {record.employeeName}
                </span>
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {hoursLabel(record.workedHours * 60)} worked
              </span>
              <AttendanceStatusBadge status={record.status} />
            </button>
          )}
        />
      </div>
    );

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <DataTable
        table={table}
        isLoading={loading}
        reorderableColumnIds={ATTENDANCE_COLUMNS}
        onRowClick={(record) => onOpen(record.id)}
        emptyState={
          <DataTableEmptyState
            icon={ClockIcon}
            title="No attendance records"
            description="Try another date range or clear your filters."
          />
        }
      />
      <div className="border-t">
        <AttendancePagination table={table} isLoading={loading} />
      </div>
    </Card>
  );
}
