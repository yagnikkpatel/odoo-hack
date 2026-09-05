'use client'

import { useState } from 'react'
import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/nexacrm/components/ui/dialog'
import { useContractsStore } from '../store'
import { contractTitle } from '../types'
import type { Contract } from '../types'

export default function ContractDeleteDialog({
  open,
  onOpenChange,
  contracts,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contracts: Contract[]
  onDeleted?: () => void
}) {
  const removeMany = useContractsStore((state) => state.removeMany)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')

  let title = `Delete ${contracts.length} contracts?`
  let description =
    'Permanently delete these contracts? This cannot be undone.'
  if (contracts.length === 1) {
    title = 'Delete contract?'
    description = `Permanently delete the ${contractTitle(contracts[0])}? This cannot be undone.`
  }

  function changeOpen(next: boolean) {
    if (isDeleting) return
    setError('')
    onOpenChange(next)
  }

  async function handleDelete() {
    if (isDeleting || contracts.length === 0) return
    setIsDeleting(true)
    setError('')
    try {
      await removeMany(contracts.map((contract) => contract.id))
      onDeleted?.()
      onOpenChange(false)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'The contracts could not be deleted. Please try again.',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="sm:max-w-sm" showCloseButton={!isDeleting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
            disabled={isDeleting}
            onClick={() => changeOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isDeleting || contracts.length === 0}
            onClick={() => void handleDelete()}
          >
            {isDeleting && <LoaderCircleIcon className="animate-spin" />}
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
