import type { RowData } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'

/*
 * ! THIS FILE HAS NO IMPORTERS AND IS NOT DEAD. It is a TanStack Table type augmentation - a
 * ! `declare module` block that widens `ColumnMeta` for every column def in the app. It applies
 * ! because it is compiled, not because anything imports it. Delete it and every `meta.label`,
 * ! `meta.icon`, `meta.filterOptions` and `meta.textFilter` in the codebase stops type-checking.
 */
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string
    icon?: LucideIcon

    filterOptions?: { label: string; value: string }[]

    textFilter?: boolean

    cellClassName?: string
  }

  interface TableMeta<TData extends RowData> {
    onEditRow?: (row: TData) => void
  }
}
