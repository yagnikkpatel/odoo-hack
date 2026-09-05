'use client'

import { useState } from 'react'
import { CheckIcon, BanIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import { DropdownMenuItem } from '@/features/nexacrm/components/ui/dropdown-menu'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'
import { EditorDialog, FormField } from '@/features/hr/components/form'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useTimeOffStore } from '../store'
import { formatAmount } from '../logic'
import type { TimeOffRequest } from '../model'

export default function RequestActions({
  record,
  onEdit,
  onDeleted,
  detail = false
}: {
  record: TimeOffRequest
  onEdit: () => void
  onDeleted?: () => void
  detail?: boolean
}) {
  const { can } = useCurrentUser()
  const [decision, setDecision] = useState<'refuse' | 'cancel' | null>(null)
  const [approvalOpen, setApprovalOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const canManage = can('records:update')
  const editable = canManage && (record.status === 'pending' || record.status === 'refused')
  const openDecision = (action: 'refuse' | 'cancel') => {
    setDecision(action)
    setReason('')
    setError(null)
  }
  const decisionItems = canManage ? (
    <>
      {record.status === 'pending' && (
        <>
          <DropdownMenuItem onClick={() => setApprovalOpen(true)}>
            <CheckIcon />
            Approve
          </DropdownMenuItem>
          <DropdownMenuItem variant='destructive' onClick={() => openDecision('refuse')}>
            <XIcon />
            Refuse
          </DropdownMenuItem>
        </>
      )}
      {record.status === 'approved' && (
        <DropdownMenuItem variant='destructive' onClick={() => openDecision('cancel')}>
          <BanIcon />
          Cancel leave
        </DropdownMenuItem>
      )}
    </>
  ) : undefined
  return (
    <div className='flex flex-wrap items-center gap-1'>
      {detail && editable && (
        <Button variant='outline' size='sm' onClick={onEdit}>
          Edit request
        </Button>
      )}
      {detail && canManage && record.status === 'pending' && (
        <>
          <Button size='sm' onClick={() => setApprovalOpen(true)}>
            <CheckIcon />
            Approve
          </Button>
          <Button variant='outline' size='sm' onClick={() => openDecision('refuse')}>
            Refuse
          </Button>
        </>
      )}
      <RowActionShell
        label='Time off request actions'
        viewHref={detail ? undefined : `/time-off/requests/${record.id}`}
        onEdit={!detail && editable ? onEdit : undefined}
        extraItems={detail && record.status === 'pending' ? undefined : decisionItems}
        onDelete={
          can('records:delete') && record.status !== 'approved'
            ? () => {
                const result = useTimeOffStore.getState().removeRequest(record.id)
                if (!result.ok) {
                  toast.error(result.error)
                  return
                }
                toast.success('Request deleted')
                onDeleted?.()
              }
            : undefined
        }
        deleteTitle='Delete this time off request?'
        deleteDescription='This removes the request and its decision history. Approved requests must be cancelled first.'
      />
      <ConfirmDialog
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        title='Approve this request?'
        variant='default'
        confirmLabel='Approve request'
        description={`Approve ${formatAmount(record.duration, record.unit)} of leave. If an allocation is required, the available balance will be checked and deducted immediately.`}
        onConfirm={() => {
          const result = useTimeOffStore.getState().approveRequest(record.id)
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success('Request approved and balance updated')
        }}
      />
      {decision && (
        <EditorDialog
          title={decision === 'refuse' ? 'Refuse this request?' : 'Cancel approved leave?'}
          description={
            decision === 'refuse'
              ? 'Tell the employee why this request is refused. No balance will be deducted.'
              : 'Cancellation releases this request’s allocation charges and keeps a record of the decision. This cannot be undone; a new request is needed to book leave again.'
          }
          submitLabel={decision === 'refuse' ? 'Confirm refusal' : 'Confirm cancellation'}
          error={error}
          onClose={() => setDecision(null)}
          onSubmit={event => {
            event.preventDefault()
            if (!reason.trim()) {
              setError('Add a reason for this decision.')
              return
            }
            const state = useTimeOffStore.getState()
            const result =
              decision === 'refuse' ? state.refuseRequest(record.id, reason) : state.cancelRequest(record.id, reason)
            if (!result.ok) {
              setError(result.error)
              return
            }
            toast.success(decision === 'refuse' ? 'Request refused' : 'Leave cancelled and balance restored')
            setDecision(null)
          }}
        >
          <FormField label='Reason for this decision' id='request-decision-reason'>
            <Textarea
              id='request-decision-reason'
              required
              value={reason}
              onChange={event => {
                setReason(event.target.value)
                setError(null)
              }}
              maxLength={2000}
              rows={4}
              placeholder='Explain this decision…'
            />
          </FormField>
        </EditorDialog>
      )}
    </div>
  )
}
