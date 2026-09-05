'use client'
import { useRef } from 'react'
import Link from 'next/link'
import {
  ExternalLinkIcon,
  FileTextIcon,
  HistoryIcon,
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
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useContract } from './store'
import type { Contract } from './types'
import ContractFields from './components/contract-fields'
import ContractHistory from './components/contract-history'
import ContractActions from './components/contract-actions'

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
  const contract = useContract(id || undefined)
  const headingRef = useRef<HTMLDivElement>(null)
  const { can } = useCurrentUser()
  return (
    <PreviewSheet
      open={Boolean(contract)}
      onClose={() => setId(null)}
      title={contract ? contract.name + ' details' : 'Contract details'}
      initialFocus={headingRef}
    >
      {contract && (
        <>
          <div
            ref={headingRef}
            tabIndex={-1}
            className="flex h-12.5 shrink-0 items-center gap-2 border-b px-4 outline-none"
          >
            <FileTextIcon className="size-4 shrink-0 text-violet-600" />
            <span className="min-w-0 flex-1 truncate font-medium">
              {contract.name}
            </span>
            <ContractActions
              contract={contract}
              onEdit={() => onEdit(contract)}
              onDeleted={() => setId(null)}
              showView={false}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close panel"
              onClick={() => setId(null)}
            >
              <XIcon />
            </Button>
          </div>
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
                <FileTextIcon className="size-3.5" />
                Details
              </TabsTrigger>
              <TabsTrigger value="history">
                <HistoryIcon className="size-3.5" />
                History
              </TabsTrigger>
            </TabsList>
            <ScrollArea className="min-h-0 flex-1">
              <div className="p-4">
                <TabsContent value="details">
                  <ContractFields contract={contract} />
                  {can('records:update') && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => onEdit(contract)}
                    >
                      <PencilIcon />
                      Edit contract
                    </Button>
                  )}
                </TabsContent>
                <TabsContent value="history">
                  <ContractHistory contract={contract} />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
          <div className="shrink-0 border-t p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              render={<Link href={'/contracts/' + contract.id} />}
            >
              <ExternalLinkIcon />
              Open full details
            </Button>
          </div>
        </>
      )}
    </PreviewSheet>
  )
}
