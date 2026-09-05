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
import { attendanceColumns, ATTENDANCE_COLUMNS } from "./columns";
import type { AttendanceListQuery, AttendanceStatus } from "./types";

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
}: {
  scope: "own" | "all";
  employeeId: string | null;
  from: string;
  to: string;
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
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    {},
  );
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
    const timer = window.setTimeout(retry, 250);
    return () => window.clearTimeout(timer);
  }, [retry]);

  const lastPage = Math.max(
    0,
    Math.ceil(serverPagination.total / pagination.pageSize) - 1,
  );
  if (
    hasHydrated &&
    !isLoading &&
    !error &&
    queryKey(query) === queryKey(loadedQuery) &&
    pagination.pageIndex > lastPage
  ) {
    setPagination((current) => ({ ...current, pageIndex: lastPage }));
  }

  const columns = useMemo(() => attendanceColumns(), []);
  const stale = queryKey(query) !== queryKey(loadedQuery);
  const data = invalidRange || stale ? [] : records;
  const total = invalidRange || stale ? 0 : serverPagination.total;
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
    exportQuery: query,
    total,
    invalidRange,
    loading: !invalidRange && (isLoading || !hasHydrated || stale),
    error,
    retry,
  };
}
