// Third-party Imports
import type { Row } from '@tanstack/react-table'

export const containsFilter = <TData>(row: Row<TData>, columnId: string, filterValue: unknown): boolean => {
  const needle = String(filterValue ?? '')
    .trim()
    .toLowerCase()

  if (!needle) return true

  return String(row.getValue(columnId) ?? '')
    .toLowerCase()
    .includes(needle)
}
