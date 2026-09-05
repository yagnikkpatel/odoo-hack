"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import type {
  ColumnFiltersState,
  PaginationState,
  VisibilityState,
} from "@tanstack/react-table";
import {
  parseAsString,
  useQueryState,
} from "@/features/nexacrm/adapters/query-state";
import { useAttendanceStore } from "./store";
import { calendarDateRange, loadAllAttendanceRecords } from "./records-query";
import { attendanceColumns, ATTENDANCE_COLUMNS } from "./columns";
import type {
  Attendance,
  AttendanceListQuery,
  AttendanceStatus,
} from "./types";

function queryKey(query: AttendanceListQuery) {
  return JSON.stringify([
    query.scope || "all",
    query.limit,
    query.offset,
    query.search || "",
    query.employeeId || "",
    query.status || "",
    query.from || "",
    query.to || "",
  ]);
}

export function useAttendanceTable({
  scope,
  employeeId,
  from,
  to,
  calendar,
  onEdit,
}: {
  scope: "own" | "all";
  employeeId: string | null;
  from: string;
  to: string;
  calendar: boolean;
  onEdit: (record: Attendance) => void;
}) {
  const records = useAttendanceStore((state) => state.records);
  const serverPagination = useAttendanceStore((state) => state.pagination);
  const isLoading = useAttendanceStore((state) => state.isLoading);
  const hasHydrated = useAttendanceStore((state) => state.hasHydrated);
  const error = useAttendanceStore((state) => state.error);
  const loadRecords = useAttendanceStore((state) => state.loadRecords);
  const loadedQuery = useAttendanceStore((state) => state.query);
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString
      .withDefault("")
      .withOptions({ history: "replace", shallow: true }),
  );
  const [month] = useQueryState("month", parseAsString.withDefault(""));
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    overtimeHours: false,
  });
  const [columnOrder, setColumnOrder] = useState([
    ...ATTENDANCE_COLUMNS,
    "actions",
  ]);
  const [columnSizing, setColumnSizing] = useState({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 15,
  });
  const status = columnFilters.find((filter) => filter.id === "status")
    ?.value as AttendanceStatus | undefined;
  const filterKey = JSON.stringify([
    scope,
    employeeId,
    search,
    status,
    from,
    to,
  ]);
  const [previousFilters, setPreviousFilters] = useState(filterKey);
  if (previousFilters !== filterKey) {
    setPreviousFilters(filterKey);
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }

  const query = useMemo<AttendanceListQuery>(
    () => ({
      scope,
      limit: pagination.pageSize,
      offset: pagination.pageIndex * pagination.pageSize,
      ...(scope === "all" && search.trim() ? { search: search.trim() } : {}),
      ...(scope === "all" && employeeId ? { employeeId } : {}),
      ...(status ? { status } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
    [scope, employeeId, search, status, from, to, pagination],
  );
  const invalidRange = Boolean(from && to && from > to);
  const retry = useCallback(() => {
    if (!invalidRange) void loadRecords(query).catch(() => {});
  }, [invalidRange, loadRecords, query]);
  useEffect(() => {
    if (calendar) return;
    const timer = window.setTimeout(retry, 250);
    return () => window.clearTimeout(timer);
  }, [calendar, retry]);

  const lastPage = Math.max(
    0,
    Math.ceil(serverPagination.total / pagination.pageSize) - 1,
  );
  if (
    !calendar &&
    hasHydrated &&
    !isLoading &&
    !error &&
    queryKey(query) === queryKey(loadedQuery) &&
    pagination.pageIndex > lastPage
  ) {
    setPagination((current) => ({ ...current, pageIndex: lastPage }));
  }

  const range = useMemo(() => calendarDateRange(month), [month]);
  const calendarQuery = useMemo<AttendanceListQuery>(
    () => ({
      ...query,
      limit: 100,
      offset: 0,
      from: from && from > range.from ? from : range.from,
      to: to && to < range.to ? to : range.to,
    }),
    [query, range, from, to],
  );
  const monthData = useCalendarRecords(calendar, calendarQuery, records);
  const columns = useMemo(() => attendanceColumns(onEdit), [onEdit]);
  const stale = queryKey(query) !== queryKey(loadedQuery);
  const data = calendar
    ? monthData.records
    : invalidRange || stale
      ? []
      : records;
  const total = calendar
    ? monthData.records.length
    : invalidRange || stale
      ? 0
      : serverPagination.total;
  const table = useReactTable({
    data,
    columns,
    rowCount: total,
    getRowId: (row) => row.id,
    state: {
      globalFilter: scope === "all" ? search : "",
      columnFilters,
      columnVisibility,
      columnOrder,
      columnSizing,
      pagination,
    },
    onGlobalFilterChange: setSearch,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    manualFiltering: true,
    manualPagination: true,
    enableSorting: false,
    enableRowSelection: false,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    autoResetPageIndex: false,
  });
  return {
    table,
    query,
    exportQuery: calendar ? calendarQuery : query,
    total,
    invalidRange,
    loading:
      !invalidRange &&
      (calendar ? monthData.loading : isLoading || !hasHydrated || stale),
    error: calendar ? monthData.error : error,
    retry: calendar ? monthData.retry : retry,
  };
}

function useCalendarRecords(
  enabled: boolean,
  query: AttendanceListQuery,
  revision: Attendance[],
) {
  const [result, setResult] = useState<{
    key: string;
    revision: Attendance[];
    attempt: number;
    records: Attendance[];
    error: string | null;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(query);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    async function loadMonth() {
      const records = await loadAllAttendanceRecords(query, controller.signal);
      if (!controller.signal.aborted)
        setResult({ key, revision, attempt, records, error: null });
    }
    void loadMonth().catch((cause) => {
      if (!controller.signal.aborted)
        setResult({
          key,
          revision,
          attempt,
          records: [],
          error:
            cause instanceof Error
              ? cause.message
              : "The calendar could not be loaded.",
        });
    });
    return () => controller.abort();
  }, [enabled, query, key, revision, attempt]);
  const current =
    result?.key === key &&
    result.revision === revision &&
    result.attempt === attempt;
  return {
    records: current ? result.records : [],
    loading: enabled && !current,
    error: current ? result.error : null,
    retry: () => setAttempt((current) => current + 1),
  };
}
