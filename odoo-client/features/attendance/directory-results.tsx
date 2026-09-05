"use client";

import type { Table } from "@tanstack/react-table";
import { ClockIcon } from "lucide-react";
import { Card } from "@/features/nexacrm/components/ui/card";
import DataTable from "@/features/nexacrm/components/data-table/data-table";
import DataTableEmptyState from "@/features/nexacrm/components/data-table/data-table-empty-state";
import { ATTENDANCE_COLUMNS } from "./columns";
import type { Attendance } from "./types";
import AttendancePagination from "./attendance-pagination";

export default function AttendanceResults({
  table,
  loading,
  onOpen,
}: {
  table: Table<Attendance>;
  loading: boolean;
  onOpen: (id: string) => void;
}) {
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
