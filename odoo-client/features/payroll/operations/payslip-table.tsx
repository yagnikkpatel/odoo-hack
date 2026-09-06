'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import type { ColumnSizingState, PaginationState, RowSelectionState, SortingState } from '@tanstack/react-table'
import { Trash2Icon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import DataTable from '@/features/nexacrm/components/data-table/data-table'
import DataTablePagination from '@/features/nexacrm/components/data-table/data-table-pagination'
import BulkActionBar from '@/features/nexacrm/components/data-table/bulk-action-bar'
import { EditorDialog } from '@/features/hr/components/form'
import { usePayrollStore, payrollErrorMessage } from '../store'
import type { Payslip } from '../types'
import { PAYSLIP_COLUMN_ORDER, payslipColumns } from './payslip-columns'

/**
 * The payslip list, used by both the Payslips page and a payrun's detail. Selection and delete are
 * opt-in via `canDelete` - a locked payrun must not offer them.
 */
export default function PayslipTable({
  slips,
  empty = 'No payslips to display.',
  loading = false,
  canDelete = false,
}: {
  slips: Payslip[]
  empty?: string
  loading?: boolean
  /** Adds the checkbox column and the bulk delete action. */
  canDelete?: boolean
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 })
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Without delete rights the checkbox column is dead weight, so drop it entirely.
  const columns = useMemo(
    () => (canDelete ? payslipColumns : payslipColumns.filter(column => column.id !== 'select')),
    [canDelete],
  )
  const columnOrder = useMemo(
    () => (canDelete ? PAYSLIP_COLUMN_ORDER : PAYSLIP_COLUMN_ORDER.filter(id => id !== 'select')),
    [canDelete],
  )

  const table = useReactTable({
    data: slips,
    columns,
    state: { sorting, rowSelection, columnSizing, columnOrder, pagination },
    getRowId: row => row.id,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: canDelete,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    autoResetPageIndex: false,
  })

  // Deleting the last row of a page would otherwise strand the operator on an empty page.
  const pageCount = table.getPageCount()
  useEffect(() => {
    if (pagination.pageIndex >= pageCount) table.setPageIndex(Math.max(0, pageCount - 1))
  }, [pageCount, pagination.pageIndex, table])

  const selected = table.getFilteredSelectedRowModel().rows.map(row => row.original)

  const remove = async () => {
    setDeleting(true)
    setError(null)
    const store = usePayrollStore.getState()
    try {
      // Sequential on purpose: each delete reloads operations, and the API rejects a locked payslip.
      for (const slip of selected) await store.removePayslip(slip.id)
      table.resetRowSelection()
      setConfirming(false)
    } catch (cause) {
      setError(payrollErrorMessage(cause))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      {canDelete && (
        <BulkActionBar table={table}>
          <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
            <Trash2Icon /> Delete
          </Button>
        </BulkActionBar>
      )}
      <div className="[&_[data-slot=table-container]]:border-b">
        {/* No drag-to-reorder: `columnOrder` is fixed here, and there is no view menu to reset it. */}
        <DataTable table={table} isLoading={loading} emptyLabel={empty} />
      </div>
      <DataTablePagination table={table} idPrefix="payslips" noun="payslip" showSelectionCount={canDelete} />
      {confirming && (
        <EditorDialog
          title={selected.length === 1 ? 'Delete payslip?' : `Delete ${selected.length} payslips?`}
          description="This removes the selected payslips from the payrun. Recompute the payrun to generate them again."
          submitLabel={deleting ? 'Deleting…' : 'Delete'}
          pending={deleting}
          error={error}
          onClose={() => {
            setConfirming(false)
            setError(null)
          }}
          onSubmit={event => {
            event.preventDefault()
            void remove()
          }}
        >
          <ul className="text-sm">
            {selected.slice(0, 8).map(slip => (
              <li key={slip.id}>
                {slip.employeeName} · {slip.startDate} – {slip.endDate}
              </li>
            ))}
            {selected.length > 8 && (
              <li className="text-muted-foreground">and {selected.length - 8} more</li>
            )}
          </ul>
        </EditorDialog>
      )}
    </>
  )
}
