'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  LoaderCircleIcon,
  PencilIcon,
  Trash2Icon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/nexacrm/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/nexacrm/components/ui/dropdown-menu'
import { downloadContractsCsv } from '../csv'
import { useContractPermissions } from '../permissions'
import { useContractsStore } from '../store'
import { contractTitle } from '../types'
import type { Contract } from '../types'

export default function ContractActions({
  contract,
  onEdit,
  onDeleted,
  showView = true,
}: {
  contract: Contract
  onEdit: () => void
  onDeleted?: () => void
  showView?: boolean
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = useContractsStore((state) => state.remove)
  const { canUpdate, canDelete } = useContractPermissions()

  function changeOpen(open: boolean) {
    if (pending) return
    setConfirmOpen(open)
    setError(null)
  }

  async function confirmDelete() {
    if (pending || !canDelete) return
    setPending(true)
    setError(null)
    try {
      await remove(contract.id)
      setConfirmOpen(false)
      onDeleted?.()
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The contract could not be deleted. Please try again.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${contractTitle(contract)}`}
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuGroup>
            {showView && (
              <DropdownMenuItem
                render={<Link href={`/contracts/${contract.id}`} />}
              >
                <EyeIcon /> View
              </DropdownMenuItem>
            )}
            {canUpdate && (
              <DropdownMenuItem onClick={onEdit}>
                <PencilIcon /> Edit
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => downloadContractsCsv([contract])}>
              <DownloadIcon /> Export record
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => changeOpen(true)}
                >
                  <Trash2Icon /> Delete contract
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmOpen} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Delete contract</DialogTitle>
            <DialogDescription>
              Permanently delete the contract for {contract.employeeName}?
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void confirmDelete()}
            >
              {pending && <LoaderCircleIcon className="animate-spin" />}
              {pending ? 'Deleting…' : 'Delete contract'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
