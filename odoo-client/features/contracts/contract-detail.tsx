'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeftIcon,
  FileTextIcon,
  LoaderCircleIcon,
  PencilIcon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import SidePanel, {
  SidePanelTrigger,
} from '@/features/nexacrm/components/layout/side-panel'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'
import RecordNavigation from '@/features/nexacrm/components/record/record-navigation'
import { useContractsStore } from './store'
import { contractTitle } from './types'
import { useContractPermissions } from './permissions'
import ContractActions from './components/contract-actions'
import ContractFields from './components/contract-fields'
import ContractHistory from './components/contract-history'
import ContractAuditLog from './components/contract-audit-log'
import ContractEditor from './components/contract-editor'
import { useContractRecord } from './components/use-contract-record'

export default function ContractDetail({ contractId }: { contractId: string }) {
  const { canRead } = useContractPermissions()
  if (!canRead) {
    return (
      <p role="alert" className="text-muted-foreground py-12">
        You do not have access to contracts.
      </p>
    )
  }
  return <ContractRecord contractId={contractId} />
}

function ContractRecord({ contractId }: { contractId: string }) {
  const router = useRouter()
  const { canUpdate } = useContractPermissions()
  const { contract, loading, error } = useContractRecord(contractId)
  const contracts = useContractsStore((state) => state.contracts)
  const [railOpen, setRailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  if (loading) {
    return (
      <div className="flex flex-1 justify-center py-16">
        <LoaderCircleIcon
          className="text-muted-foreground size-5 animate-spin"
          aria-label="Loading contract"
        />
      </div>
    )
  }
  if (!contract) {
    if (error) {
      return (
        <div role="alert" className="space-y-3 py-12">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" size="sm" render={<Link href="/contracts" />}>
            Back to contracts
          </Button>
        </div>
      )
    }
    return (
      <RecordNotFound
        label="Contract"
        backHref="/contracts"
        backLabel="Contracts"
      />
    )
  }

  const index = contracts.findIndex((item) => item.id === contractId)
  const title = contractTitle(contract)
  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b py-2">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to contracts"
          render={<Link href="/contracts" />}
          className="text-muted-foreground hover:text-foreground -ml-1 shrink-0"
        >
          <ArrowLeftIcon />
        </Button>
        <FileTextIcon className="size-4 shrink-0 text-violet-600" />
        <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight">
          {title}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          {index >= 0 && (
            <RecordNavigation
              index={index}
              total={contracts.length}
              moduleLabel="Contracts"
              previousHref={
                index > 0 ? `/contracts/${contracts[index - 1].id}` : undefined
              }
              nextHref={
                index < contracts.length - 1
                  ? `/contracts/${contracts[index + 1].id}`
                  : undefined
              }
            />
          )}
          <SidePanelTrigger
            side="left"
            breakpoint="xl"
            label="Show contract details"
            onClick={() => setRailOpen(true)}
          />
          <ContractActions
            contract={contract}
            onEdit={() => setEditOpen(true)}
            onDeleted={() => router.push('/contracts')}
            showView={false}
          />
        </div>
      </div>
      <div className="grid xl:min-h-0 xl:flex-1 xl:grid-cols-[20rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]">
        <SidePanel
          side="left"
          breakpoint="xl"
          open={railOpen}
          onOpenChange={setRailOpen}
          title={`${title} details`}
          description="Employee, effective dates, wage, and status."
          className="xl:min-h-0 xl:border-r"
        >
          <ScrollArea className="xl:h-full">
            <div className="xl:py-4 xl:pr-4">
              <ContractFields contract={contract} />
              {canUpdate && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => setEditOpen(true)}
                >
                  <PencilIcon /> Edit contract
                </Button>
              )}
            </div>
          </ScrollArea>
        </SidePanel>
        <ScrollArea className="xl:min-h-0 xl:flex-1">
          <div className="space-y-8 py-4 xl:px-4">
            <ContractHistory contract={contract} />
            <ContractAuditLog contract={contract} />
          </div>
        </ScrollArea>
      </div>
      {editOpen && (
        <ContractEditor
          key={contract.id}
          contract={contract}
          onClose={() => setEditOpen(false)}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
