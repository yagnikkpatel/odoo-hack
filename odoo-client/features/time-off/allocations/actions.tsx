'use client'

import { useState } from 'react'
import { CheckIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { Button } from '@/features/nexacrm/components/ui/button'
import { DropdownMenuItem } from '@/features/nexacrm/components/ui/dropdown-menu'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import { EditorDialog, FormField } from '@/features/hr/components/form'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useTimeOffStore } from '../store'
import type { Allocation } from '../model'

function RefuseAllocationDialog({ allocationId, onClose }: { allocationId: string; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <EditorDialog
      title='Refuse allocation'
      description='Explain why this allocation cannot be approved. The reason is saved in its history.'
      submitLabel='Refuse allocation'
      error={error}
      onClose={onClose}
      onSubmit={event => {
        event.preventDefault()
        const result = useTimeOffStore.getState().refuseAllocation(allocationId, reason)
        if (!result.ok) {
          setError(result.error)
          return
        }
        toast.success('Allocation refused')
        onClose()
      }}
    >
      <FormField id='allocation-refusal' label='Reason for refusal'>
        <Textarea
          id='allocation-refusal'
          required
          autoFocus
          value={reason}
          onChange={event => {
            setReason(event.target.value)
            setError(null)
          }}
        />
      </FormField>
    </EditorDialog>
  )
}

function approveAllocation(id: string) {
  const result = useTimeOffStore.getState().approveAllocation(id)
  if (!result.ok) {
    toast.error(result.error)
    return
  }
  toast.success('Allocation approved — the balance is now available during its validity period')
}

export function AllocationDecisionControls({ allocation }: { allocation: Allocation }) {
  const { can } = useCurrentUser()
  const [refusing, setRefusing] = useState(false)
  if (allocation.status !== 'pending' || !can('records:update')) return null
  return (
    <>
      <div className='flex flex-wrap gap-2'>
        <Button size='sm' onClick={() => approveAllocation(allocation.id)}>
          <CheckIcon />
          Approve allocation
        </Button>
        <Button variant='outline' size='sm' onClick={() => setRefusing(true)}>
          <XIcon />
          Refuse
        </Button>
      </div>
      {refusing && <RefuseAllocationDialog allocationId={allocation.id} onClose={() => setRefusing(false)} />}
    </>
  )
}

export default function AllocationActions({
  allocation,
  onEdit,
  onDeleted,
  detail = false
}: {
  allocation: Allocation
  onEdit: () => void
  onDeleted?: () => void
  detail?: boolean
}) {
  const { can } = useCurrentUser()
  const [refusing, setRefusing] = useState(false)
  if (detail && (allocation.status === 'approved' || (!can('records:update') && !can('records:delete')))) return null
  return (
    <>
      <RowActionShell
        label={'Actions for allocation ' + allocation.id}
        viewHref={detail ? undefined : '/time-off/allocations/' + allocation.id}
        onEdit={can('records:update') && allocation.status !== 'approved' ? onEdit : undefined}
        onDelete={
          can('records:delete') && allocation.status !== 'approved'
            ? () => {
                const result = useTimeOffStore.getState().removeAllocation(allocation.id)
                if (!result.ok) {
                  toast.error(result.error)
                  return
                }
                toast.success('Allocation deleted')
                onDeleted?.()
              }
            : undefined
        }
        extraItems={
          can('records:update') && allocation.status === 'pending' ? (
            <>
              <DropdownMenuItem onClick={() => approveAllocation(allocation.id)}>
                <CheckIcon />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRefusing(true)}>
                <XIcon />
                Refuse
              </DropdownMenuItem>
            </>
          ) : undefined
        }
        deleteTitle='Delete allocation?'
        deleteDescription='Only unapproved allocations can be deleted. Approved balances and their consumption history are preserved.'
      />
      {refusing && <RefuseAllocationDialog allocationId={allocation.id} onClose={() => setRefusing(false)} />}
    </>
  )
}
