'use client'

import { useState } from 'react'
import { MailIcon, SendIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/features/nexacrm/components/ui/dialog'
import { usePayrollStore } from './store'
import type { Payrun, Payslip, SendPayslipsResult } from './types'

const validEmail = (email: string) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)

export default function DeliveryDialog({
  run,
  slips,
  onClose
}: {
  run: Payrun
  slips: Payslip[]
  onClose: () => void
}) {
  const [selected, setSelected] = useState(() => slips.filter(slip => validEmail(slip.employeeEmail)).map(slip => slip.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<SendPayslipsResult | null>(null)
  async function send() {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await usePayrollStore.getState().sendPayslips(run.id, selected))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to send payslips.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={open => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className='flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Send payslips</DialogTitle>
          <DialogDescription>Email each employee their payslip PDF for {run.name}.</DialogDescription>
        </DialogHeader>
        <div className='min-h-0 space-y-4 overflow-y-auto'>
          <div className='divide-y rounded-lg border'>
            {slips.map(slip => (
              <label key={slip.id} className='flex items-center gap-3 p-3'>
                <Checkbox
                  checked={selected.includes(slip.id)}
                  disabled={!validEmail(slip.employeeEmail) || busy}
                  onCheckedChange={checked =>
                    setSelected(current => (checked ? [...current, slip.id] : current.filter(id => id !== slip.id)))
                  }
                  aria-label={`Include ${slip.employeeName}`}
                />
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm font-medium'>{slip.employeeName}</span>
                  <span className='text-muted-foreground block truncate text-xs'>
                    {slip.employeeEmail || 'Missing email address'}
                  </span>
                </span>
                {slip.sentAt && <span className='text-muted-foreground text-xs'>Sent</span>}
                {!validEmail(slip.employeeEmail) && <span className='text-destructive text-xs'>Invalid email</span>}
              </label>
            ))}
          </div>
          {result && (
            <div role='status' className='bg-muted/40 space-y-1 rounded-lg border p-3 text-sm'>
              {result.transport === 'smtp' ? (
                <p className='flex items-center gap-2'>
                  <MailIcon className='size-4' />
                  Sent {result.sent.length} payslip{result.sent.length === 1 ? '' : 's'} by email.
                </p>
              ) : (
                <p className='flex items-start gap-2'>
                  <MailIcon className='mt-0.5 size-4 shrink-0' />
                  <span>
                    Email delivery is not configured on the server (SMTP). {result.sent.length} payslip
                    {result.sent.length === 1 ? ' was' : 's were'} generated and logged instead; nothing was emailed.
                  </span>
                </p>
              )}
              {result.skipped.map(item => (
                <p key={item.payslipId} className='text-muted-foreground text-xs'>
                  Skipped {item.employeeName}: {item.reason}
                </p>
              ))}
            </div>
          )}
          {error && (
            <p role='alert' className='text-destructive text-sm'>
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant='outline' disabled={busy} onClick={onClose}>
            Close
          </Button>
          <Button disabled={busy || !selected.length} onClick={send}>
            <SendIcon />
            {busy ? 'Sending…' : `Send ${selected.length} payslip${selected.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
