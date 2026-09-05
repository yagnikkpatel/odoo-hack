'use client'
import DataConnectionNotice from '@/features/hr/components/data-connection-notice'
import { useState } from 'react'
import {
  DownloadIcon,
  FileTextIcon,
  PlusIcon,
  SearchXIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card } from '@/features/nexacrm/components/ui/card'
import DataTable from '@/features/nexacrm/components/data-table/data-table'
import DataTablePagination from '@/features/nexacrm/components/data-table/data-table-pagination'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import DataTableViewOptions from '@/features/nexacrm/components/data-table/data-table-view-options'
import RecordViewBar from '@/features/nexacrm/components/data-table/record-view-bar'
import BulkActionBar from '@/features/nexacrm/components/data-table/bulk-action-bar'
import { deriveFilterOptions } from '@/features/nexacrm/components/data-table/derive-filter-options'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { employeeName } from '@/features/employees/types'
import { useContractsStore } from './store'
import { CONTRACT_STATUSES } from './types'
import type { Contract } from './types'
import { useContractsTable } from './table/use-contracts-table'
import { REORDERABLE_COLUMN_IDS } from './table/columns'
import ContractPanel, { useContractPreview } from './contract-panel'
import ContractEditor from './components/contract-editor'
import { downloadContractsCsv } from './csv'

export default function ContractsView() {
  const { can } = useCurrentUser()
  const [editor, setEditor] = useState<Contract | 'new' | null>(null)
  const [, setPreviewId] = useContractPreview()
  const { table, employees, employeeId, setEmployeeId, isFiltered } =
    useContractsTable(setEditor)
  const hasHydrated = useContractsStore((state) => state.hasHydrated)
  const scopedEmployee = employees.find(
    (employee) => employee.id === employeeId,
  )
  return (
    <div className="flex min-h-full flex-col">
      <RecordViewBar
        table={table}
        viewName="Contracts"
        count={table.getFilteredRowModel().rows.length}
        icon={FileTextIcon}
        searchPlaceholder="Search contracts…"
        dynamicFilterOptions={{
          status: Object.entries(CONTRACT_STATUSES).map(([value, label]) => ({
            value,
            label,
          })),
          department: deriveFilterOptions(
            table,
            (contract) => contract.department,
          ),
          salaryStructure: deriveFilterOptions(
            table,
            (contract) => contract.salaryStructure,
          ),
        }}
        options={
          <DataTableViewOptions
            table={table}
            reorderableColumnIds={REORDERABLE_COLUMN_IDS}
            onExport={() =>
              downloadContractsCsv(
                table.getFilteredRowModel().rows.map((row) => row.original),
              )
            }
          />
        }
        actions={
          can('records:create') ? (
            <Button
              size="sm"
              className={ACCENT_ICON_BUTTON}
              onClick={() => setEditor('new')}
            >
              <PlusIcon />
              <span className="max-sm:hidden">New contract</span>
              <span className="sr-only sm:hidden">New contract</span>
            </Button>
          ) : null
        }
      />
      <div className={PAGE_BODY}>
        <DataConnectionNotice />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {employeeId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEmployeeId(null)}
            >
              {scopedEmployee
                ? employeeName(scopedEmployee)
                : 'Employee filter'}
              <XIcon className="size-3" />
              <span className="sr-only">Clear employee filter</span>
            </Button>
          )}
        </div>
        <Card className="flex flex-1 flex-col gap-0 overflow-hidden py-0">
          <BulkActionBar table={table}>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadContractsCsv(
                  table
                    .getFilteredSelectedRowModel()
                    .rows.map((row) => row.original),
                )
              }
            >
              <DownloadIcon />
              Export selected
            </Button>
          </BulkActionBar>
          <div className="flex flex-1 flex-col [&_[data-slot=table-container]]:border-b">
            <DataTable
              table={table}
              isLoading={!hasHydrated}
              reorderableColumnIds={REORDERABLE_COLUMN_IDS}
              onRowClick={(contract) => setPreviewId(contract.id)}
              emptyState={
                <DataTableEmptyState
                  icon={isFiltered ? SearchXIcon : FileTextIcon}
                  title={
                    isFiltered
                      ? 'No contracts match your filters'
                      : 'No contracts yet'
                  }
                  description={
                    isFiltered
                      ? 'Try another search or clear the filters.'
                      : 'Contracts will appear after the data connection is configured.'
                  }
                  action={
                    isFiltered ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          table.setGlobalFilter('')
                          table.resetColumnFilters()
                        }}
                      >
                        Clear filters
                      </Button>
                    ) : can('records:create') ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditor('new')}
                      >
                        <PlusIcon />
                        New contract
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
          </div>
          <div className="border-t">
            <DataTablePagination table={table} idPrefix="contracts" />
          </div>
        </Card>
      </div>
      <ContractPanel onEdit={setEditor} />
      {editor && (
        <ContractEditor
          contract={editor === 'new' ? undefined : editor}
          employeeId={employeeId || undefined}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            table.setGlobalFilter('')
            table.resetColumnFilters()
            setPreviewId(id)
          }}
        />
      )}
    </div>
  )
}
