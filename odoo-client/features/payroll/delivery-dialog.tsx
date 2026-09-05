'use client'

import { useState } from 'react'
import JSZip from 'jszip'
import { DownloadIcon, MailIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/features/nexacrm/components/ui/dialog'
import { usePayrollStore } from './store'
import type { Payrun } from './types'
import { downloadBlob, generatePayslipPdf, payslipFilename } from './documents'

function base64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/.{1,76}/g, '$&\r\n').trim()
}
const header = (text: string) => `=?UTF-8?B?${btoa(unescape(encodeURIComponent(text.replace(/[\r\n]/g, ' '))))}?=`
const validEmail = (email: string) => /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/.test(email)

export default function DeliveryDialog({ run, onClose }: { run: Payrun; onClose: () => void }) {
  const slips = usePayrollStore(state => state.payslips).filter(slip => slip.payrunId === run.id)
  const [selected, setSelected] = useState(() => slips.filter(slip => validEmail(slip.employeeEmail)).map(slip => slip.id))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [prepared, setPrepared] = useState(false)
  async function prepare() {
    setBusy(true); setError(''); setPrepared(false)
    try {
      const zip = new JSZip()
      for (const slip of slips.filter(slip => selected.includes(slip.id))) {
        if (!validEmail(slip.employeeEmail)) throw new Error(`Correct the email address for ${slip.employeeName}.`)
        const boundary = 'payroll_' + crypto.randomUUID().replaceAll('-', '')
        const pdf = await generatePayslipPdf(slip, run)
        const body = `Hello ${slip.employeeName},\n\nPlease find your payslip for ${slip.startDate} to ${slip.endDate} attached.\n\nHR & Payroll\nOdoo`
        const eml = [
          'X-Unsent: 1', `To: ${slip.employeeEmail}`, `Subject: ${header(`Your payslip: ${slip.startDate} to ${slip.endDate}`)}`,
          'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${boundary}"`, '',
          `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', base64(new TextEncoder().encode(body)),
          `--${boundary}`, `Content-Type: application/pdf; name="${payslipFilename(slip)}"`, 'Content-Transfer-Encoding: base64',
          `Content-Disposition: attachment; filename="${payslipFilename(slip)}"`, '', base64(pdf), `--${boundary}--`, '',
        ].join('\r\n')
        zip.file(`${slip.employeeId}-${payslipFilename(slip).replace('.pdf', '.eml')}`, eml)
      }
      downloadBlob(await zip.generateAsync({ type: 'blob' }), `payslips-${run.startDate}-email-drafts.zip`)
      setPrepared(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to prepare payslips.') }
    finally { setBusy(false) }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-xl">
      <DialogHeader><DialogTitle>Send payslips</DialogTitle><DialogDescription>Review recipients for {run.name}.</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto">
        <div className="bg-muted/50 rounded-lg border p-3 text-sm"><MailIcon className="mb-2 size-4" />Email delivery isn’t connected yet. Download individual email drafts with attached payslip PDFs, then open and send them using your email application.</div>
        <div className="divide-y rounded-lg border">
          {slips.map(slip => <label key={slip.id} className="flex items-center gap-3 p-3">
            <Checkbox checked={selected.includes(slip.id)} disabled={!validEmail(slip.employeeEmail) || busy} onCheckedChange={checked => setSelected(current => checked ? [...current, slip.id] : current.filter(id => id !== slip.id))} aria-label={`Include ${slip.employeeName}`} />
            <span className="min-w-0"><span className="block text-sm font-medium">{slip.employeeName}</span><span className="text-muted-foreground block truncate text-xs">{slip.employeeEmail || 'Missing email address'}</span></span>
            {!validEmail(slip.employeeEmail) && <span className="text-destructive ml-auto text-xs">Invalid email</span>}
          </label>)}
        </div>
        {prepared && <p role="status" className="text-sm">Email drafts downloaded. No emails have been sent.</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button disabled={busy || !selected.length || !['validated', 'paid'].includes(run.status)} onClick={prepare}><DownloadIcon />{busy ? 'Preparing PDFs…' : `Download ${selected.length} email drafts`}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
