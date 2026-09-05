'use client'

import { useState } from 'react'
import { CheckIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { Button } from '@/features/nexacrm/components/ui/button'
import { DropdownMenuItem } from '@/features/nexacrm/components/ui/dropdown-menu'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import { EditorDialog, FormField } from '@/features/hr/components/form'
import { useTimeOffPermissions } from '../permissions'
import { useTimeOffStore } from '../store'
import type { Allocation } from '../model'

function RefuseAllocationDialog({ allocationId, onClose }: { allocationId: string; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  return (
    <EditorDialog
      title='Refuse allocation'
      description='Explain why this allocation cannot be approved. The reason is saved in its history.'
      submitLabel='Refuse allocation'
      error={error}
      pending={submitting}
      onClose={onClose}
      onSubmit={async event => {
        event.preventDefault()
        setSubmitting(true)
        const result = await useTimeOffStore.getState().refuseAllocation(allocationId, reason)
        if (!result.ok) {
          setSubmitting(false)
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

/**
 * Approval is shared by the two components below, so it lives in a hook: each component gets its
 * own pending flag rather than the module-level free function this used to be, which had nowhere
 * to hold in-flight state once the mutation became async.
 */
function useApproveAllocation() {
  const [approving, setApproving] = useState(false)
  const approve = async (id: string) => {
    if (approving) return
    setApproving(true)
    const result = await useTimeOffStore.getState().approveAllocation(id)
    setApproving(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success('Allocation approved — the balance is now available during its validity period')
  }
  return { approving, approve }
}

export function AllocationDecisionControls({ allocation }: { allocation: Allocation }) {
  const { canApprove } = useTimeOffPermissions()
  const { approving, approve } = useApproveAllocation()
  const [refusing, setRefusing] = useState(false)
  if (allocation.status !== 'pending' || !canApprove) return null
  return (
    <>
      <div className='flex flex-wrap gap-2'>
        <Button size='sm' disabled={approving} onClick={() => void approve(allocation.id)}>
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
  const { canUpdate, canDelete, canApprove } = useTimeOffPermissions()
  const { approving, approve } = useApproveAllocation()
  const [refusing, setRefusing] = useState(false)
  if (detail && (allocation.status === 'approved' || (!canUpdate && !canDelete))) return null
  return (
    <>
      <RowActionShell
        label={'Actions for allocation ' + allocation.id}
        viewHref={detail ? undefined : '/time-off/allocations/' + allocation.id}
        onEdit={canUpdate && allocation.status !== 'approved' ? onEdit : undefined}
        onDelete={
          canDelete && allocation.status !== 'approved'
            ? async () => {
                const result = await useTimeOffStore.getState().removeAllocation(allocation.id)
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
          canApprove && allocation.status === 'pending' ? (
            <>
              <DropdownMenuItem disabled={approving} onClick={() => void approve(allocation.id)}>
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
