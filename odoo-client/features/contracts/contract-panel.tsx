'use client'

import { useRef } from 'react'
import Link from 'next/link'
import {
  ExternalLinkIcon,
  FileTextIcon,
  HistoryIcon,
  LoaderCircleIcon,
  PencilIcon,
  XIcon,
} from 'lucide-react'
import {
  parseAsString,
  useQueryState,
} from '@/features/nexacrm/adapters/query-state'
import { Button } from '@/features/nexacrm/components/ui/button'
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/features/nexacrm/components/ui/tabs'
import PreviewSheet from '@/features/nexacrm/components/record/preview-sheet'
import type { Contract } from './types'
import { contractTitle } from './types'
import { useContractPermissions } from './permissions'
import ContractFields from './components/contract-fields'
import ContractAuditLog from './components/contract-audit-log'
import ContractActions from './components/contract-actions'
import { useContractRecord } from './components/use-contract-record'

export const useContractPreview = () =>
  useQueryState(
    'record',
    parseAsString.withOptions({ history: 'push', shallow: true }),
  )

export default function ContractPanel({
  onEdit,
}: {
  onEdit: (contract: Contract) => void
}) {
  const [id, setId] = useContractPreview()
  const { contract, loading, error } = useContractRecord(id)
  const headingRef = useRef<HTMLDivElement>(null)
  const { canUpdate } = useContractPermissions()
  const title = contract ? contractTitle(contract) : 'Contract details'

  return (
    <PreviewSheet
      open={Boolean(id)}
      onClose={() => setId(null)}
      title={title}
      initialFocus={headingRef}
    >
      <div
        ref={headingRef}
        tabIndex={-1}
        className="flex h-12.5 shrink-0 items-center gap-2 border-b px-4 outline-none"
      >
        <FileTextIcon className="size-4 shrink-0 text-violet-600" />
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {contract && (
          <ContractActions
            contract={contract}
            onEdit={() => onEdit(contract)}
            onDeleted={() => setId(null)}
            showView={false}
          />
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close panel"
          onClick={() => setId(null)}
        >
          <XIcon />
        </Button>
      </div>
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <LoaderCircleIcon
            className="text-muted-foreground size-5 animate-spin"
            aria-label="Loading contract"
          />
        </div>
      )}
      {error && !loading && (
        <div role="alert" className="text-destructive p-4 text-sm">
          {error}
        </div>
      )}
      {contract && !loading && (
        <>
          <Tabs
            key={contract.id}
            defaultValue="details"
            className="flex min-h-0 flex-1 flex-col gap-0"
          >
            <TabsList
              variant="line"
              className="w-full shrink-0 justify-start rounded-none border-b px-2 pb-1 group-data-horizontal/tabs:h-10"
            >
              <TabsTrigger value="details">
                <FileTextIcon className="size-3.5" /> Details
              </TabsTrigger>
              <TabsTrigger value="history">
                <HistoryIcon className="size-3.5" /> History
              </TabsTrigger>
            </TabsList>
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4">
                <TabsContent value="details">
                  <ContractFields contract={contract} />
                  {canUpdate && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => onEdit(contract)}
                    >
                      <PencilIcon /> Edit contract
                    </Button>
                  )}
                </TabsContent>
                <TabsContent value="history">
                  <ContractAuditLog contract={contract} />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <div className="shrink-0 border-t p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              render={<Link href={`/contracts/${contract.id}`} />}
            >
              <ExternalLinkIcon /> Open full details
            </Button>
          </div>
        </>
      )}
    </PreviewSheet>
  )
}
