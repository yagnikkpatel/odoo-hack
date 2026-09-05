// Third-party Imports
import type { Table } from '@tanstack/react-table'

export const deriveFilterOptions = <TData>(
  table: Table<TData>,
  accessor: (row: TData) => string | undefined
): { label: string; value: string }[] => {
  const seen = new Set<string>()

  for (const row of table.getCoreRowModel().rows) {
    const value = accessor(row.original)?.trim()

    if (value) seen.add(value)
  }

  return [...seen].sort((a, b) => a.localeCompare(b)).map(value => ({ label: value, value }))
}
