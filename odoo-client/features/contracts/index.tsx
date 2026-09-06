'use client'

import { useState } from 'react'
import {
  FileTextIcon,
  PlusIcon,
  RefreshCwIcon,
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
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { useContractsStore } from './store'
import { CONTRACT_STATUSES } from './types'
import type { Contract } from './types'
import { useContractsTable } from './table/use-contracts-table'
import { REORDERABLE_COLUMN_IDS } from './table/columns'
import ContractsBulkActions from './table/bulk-actions'
import ContractPanel, { useContractPreview } from './contract-panel'
import ContractEditor from './components/contract-editor'
import { downloadContractsCsv } from './csv'
import { useContractPermissions } from './permissions'

export default function ContractsView() {
  const { canRead } = useContractPermissions()
  if (!canRead) {
    return (
      <p role="alert" className="text-muted-foreground py-12">
        You do not have access to contracts.
      </p>
    )
  }
  return <ContractDirectory />
}

function ContractDirectory() {
  const { canCreate } = useContractPermissions()
  const [editor, setEditor] = useState<Contract | 'new' | null>(null)
  const [, setPreviewId] = useContractPreview()
  const {
    table,
    employeeId,
    setEmployeeId,
    isLoading,
    error,
    retry,
    visibleCount,
    isFiltered,
  } = useContractsTable(setEditor)
  const contracts = useContractsStore((state) => state.contracts)
  const scopedEmployee = contracts.find(
    (contract) => contract.employeeId === employeeId,
  )

  let records = (
    <Card className="flex flex-1 flex-col gap-0 overflow-hidden py-0">
      <ContractsBulkActions table={table} />
      <div className="flex flex-1 flex-col [&_[data-slot=table-container]]:border-b">
        <DataTable
          table={table}
          isLoading={isLoading}
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
                  : 'Create the first employee contract.'
              }
              action={
                isFiltered ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      table.setGlobalFilter('')
                      table.resetColumnFilters()
                      setEmployeeId(null)
                    }}
                  >
                    Clear filters
                  </Button>
                ) : canCreate ? (
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
        <DataTablePagination table={table} idPrefix="contracts" noun="contract" />
      </div>
    </Card>
  )

  if (error) {
    records = (
      <div
        role="alert"
        className="border-destructive/20 bg-destructive/5 flex items-center justify-between gap-4 rounded-lg border p-4"
      >
        <div>
          <p className="font-medium">Contracts could not be loaded</p>
          <p className="text-muted-foreground mt-1 text-sm">{error}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          onClick={retry}
        >
          <RefreshCwIcon /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <RecordViewBar
        table={table}
        viewName="Contracts"
        count={visibleCount}
        icon={FileTextIcon}
        searchPlaceholder="Search employee name or email…"
        showSort={false}
        showSearch
        showFilterFieldLabels={false}
        showFilterChips={false}
        dynamicFilterOptions={{
          status: Object.entries(CONTRACT_STATUSES).map(([value, label]) => ({
            value,
            label,
          })),
        }}
        options={
          <DataTableViewOptions
            table={table}
            reorderableColumnIds={REORDERABLE_COLUMN_IDS}
            showCopyLink={false}
            onExport={() => downloadContractsCsv(contracts)}
          />
        }
        actions={
          canCreate ? (
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
        {employeeId && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEmployeeId(null)}
            >
              {scopedEmployee?.employeeName || 'Employee filter'}
              <XIcon className="size-3" />
              <span className="sr-only">Clear employee filter</span>
            </Button>
          </div>
        )}
        {records}
      </div>
      <ContractPanel onEdit={setEditor} />
      {editor && (
        <ContractEditor
          contract={editor === 'new' ? undefined : editor}
          employeeId={employeeId || undefined}
          onClose={() => setEditor(null)}
          onSaved={(id) => setPreviewId(id)}
        />
      )}
    </div>
  )
}
