'use client'

import { useEffect, useRef, useState } from 'react'
import JSZip from 'jszip'
import { DownloadIcon, MailIcon, SendIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/features/nexacrm/components/ui/dialog'
import { usePayrollStore } from './store'
import { getEmailDeliveryReadiness, listPayrunDeliveries, sendPayrunPayslips } from './service'
import type { DeliveryDispatch, Payrun, PayslipDelivery } from './types'
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
  const [deliveries, setDeliveries] = useState<PayslipDelivery[]>([])
  const [readiness, setReadiness] = useState<{ available: boolean; reason: string } | null>(null)
  const [statusError, setStatusError] = useState('')
  const [confirmResend, setConfirmResend] = useState(false)
  const initialized = useRef(false)
  const [refreshVersion, setRefreshVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      try {
        const [history, availability] = await Promise.all([
          listPayrunDeliveries(run.id, controller.signal), getEmailDeliveryReadiness(controller.signal),
        ])
        if (controller.signal.aborted) return
        setDeliveries(history); setReadiness(availability); setStatusError('')
        const inFlight = new Set(history.filter(item => item.status === 'queued' || item.status === 'sending').map(item => item.payslipId))
        const sent = new Set(history.filter(item => item.status === 'sent').map(item => item.payslipId))
        const firstLoad = !initialized.current
        initialized.current = true
        if (firstLoad) setSelected(current => current.filter(id => !inFlight.has(id) && !sent.has(id)))
      } catch (cause) {
        if (!controller.signal.aborted) {
          setReadiness(null)
          setStatusError(cause instanceof Error ? cause.message : 'Unable to refresh delivery status.')
        }
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(refresh, 3000)
      }
    }
    void refresh()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [run.id, refreshVersion])
  const sendingIds = new Set(deliveries.filter(item => item.status === 'queued' || item.status === 'sending').map(item => item.payslipId))
  const sendable = selected.filter(id => !sendingIds.has(id))
  const selectedDeliveries = deliveries.filter(item => selected.includes(item.payslipId))
  const needsResendReview = selectedDeliveries.some(item => item.status === 'sent' || item.error.includes('outcome is unknown'))
  const [error, setError] = useState('')
  const [prepared, setPrepared] = useState(false)
  const [dispatch, setDispatch] = useState<DeliveryDispatch | null>(null)
  async function send() {
    if (needsResendReview && !confirmResend) { setConfirmResend(true); return }
    setBusy(true); setError(''); setDispatch(null)
    try {
      const result = await sendPayrunPayslips(run.id, { payslipIds: sendable })
      setDispatch(result)
      const queuedIds = new Set(result.queued.map(item => item.payslipId))
      setDeliveries(current => [...current.filter(item => !queuedIds.has(item.payslipId)), ...result.queued])
      setSelected(current => current.filter(id => !queuedIds.has(id)))
      setConfirmResend(false)
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to send payslips.') }
    finally { setBusy(false); setRefreshVersion(value => value + 1) }
  }
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
        <div className="bg-muted/50 rounded-lg border p-3 text-sm"><MailIcon className="mb-2 size-4" />Send payslips to the selected recipients, or download email drafts with attached PDFs.</div>
        <div className="divide-y rounded-lg border">
          {slips.map(slip => {
            const delivery = deliveries.find(item => item.payslipId === slip.id)
            return <label key={slip.id} className="flex items-center gap-3 p-3">
            <Checkbox checked={selected.includes(slip.id)} disabled={!validEmail(slip.employeeEmail) || busy} onCheckedChange={checked => { setConfirmResend(false); setSelected(current => checked ? [...current, slip.id] : current.filter(id => id !== slip.id)) }} aria-label={`Include ${slip.employeeName}`} />
            <span className="min-w-0"><span className="block text-sm font-medium">{slip.employeeName}</span><span className="text-muted-foreground block truncate text-xs">{slip.employeeEmail || 'Missing email address'}</span>{delivery && <span className="mt-1 block text-xs"><span className="capitalize">{delivery.status}</span>{delivery.error && <span className="text-destructive block">{delivery.error}</span>}</span>}</span>
            {!validEmail(slip.employeeEmail) && <span className="text-destructive ml-auto text-xs">Invalid email</span>}
          </label>})}
        </div>
        {dispatch && <p role="status" className="text-sm">{dispatch.queued.length} payslips queued for delivery. {dispatch.skipped.map(item => `${item.employeeName}: ${item.reason}`).join(" ")}</p>}{prepared && <p role="status" className="text-sm">Email drafts downloaded. No emails have been sent.</p>}
        <p role="status" className="text-muted-foreground text-xs">{readiness?.reason || 'Checking email availability…'}</p>
        {statusError && <p role="alert" className="text-destructive text-sm">{statusError}</p>}
        {confirmResend && <p role="alert" className="rounded-lg border p-3 text-sm">Some selected payslips were already sent or have an uncertain delivery outcome. Check the recipient’s inbox before sending another copy. Press Confirm resend to continue.</p>}
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      </div>
      <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Close</Button><Button disabled={busy || !selected.length || !['validated', 'paid'].includes(run.status)} onClick={prepare}><DownloadIcon />{busy ? 'Preparing PDFs…' : `Download ${selected.length} email drafts`}</Button><Button disabled={busy || !sendable.length || !readiness?.available || !['validated', 'paid'].includes(run.status)} onClick={send}><SendIcon/>{busy ? 'Please wait…' : confirmResend ? 'Confirm resend' : `Send ${sendable.length} payslips`}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
