'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowLeftIcon, FileTextIcon, LoaderCircleIcon, PrinterIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'
import { usePayrollPermissions } from '../permissions'
import { downloadPayslipPdf } from '../service'
import { selectPayslip, usePayrollStore } from '../store'
import { isLocked } from '../types'
import usePayrollData from '../components/use-payroll-data'
import PayrollStatusBadge from '../components/status-badge'
import { AccessDenied } from '../components/list-page'
import PayslipContent from './payslip-content'

export default function PayslipDetail({ id }: { id: string }) {
  usePayrollData()
  const router = useRouter()
  const slip = usePayrollStore(selectPayslip(id))
  const hydrated = usePayrollStore(state => state.hasHydrated)
  const loadError = usePayrollStore(state => state.error)
  const { canRead, canDelete } = usePayrollPermissions()
  const [printing, setPrinting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirm, setConfirm] = useState(false)
  if (!canRead) return <AccessDenied />
  if (!hydrated)
    return (
      <p role='status' className='py-8 text-sm'>
        Loading payslip…
      </p>
    )
  if (!slip && loadError)
    return (
      <p role='alert' className='text-destructive py-8 text-sm'>
        {loadError}
      </p>
    )
  if (!slip) return <RecordNotFound label='Payslip' backHref='/payslips' backLabel='Payslips' />
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-2 border-b py-3'>
        <Button variant='ghost' size='icon-sm' aria-label='Back to payslips' render={<Link href='/payslips' />}>
          <ArrowLeftIcon />
        </Button>
        <FileTextIcon className='size-4 text-rose-600' />
        <h1 className='mr-auto min-w-0 truncate text-base font-semibold tracking-tight'>{slip.employeeName} · Payslip</h1>
        <PayrollStatusBadge status={slip.status} />
        {canDelete && !isLocked(slip.status) && (
          <Button size='icon-sm' variant='ghost' aria-label='Delete payslip' onClick={() => setConfirm(true)}>
            <Trash2Icon />
          </Button>
        )}
        <Button
          size='sm'
          variant='outline'
          disabled={printing || slip.status === 'draft'}
          onClick={async () => {
            setPrinting(true)
            try {
              await downloadPayslipPdf(slip.id, `payslip-${slip.employeeName.replace(/[^a-z0-9]+/gi, '-')}-${slip.startDate}.pdf`)
            } catch (cause) {
              toast.error(cause instanceof Error ? cause.message : 'Could not generate the payslip PDF.')
            } finally {
              setPrinting(false)
            }
          }}
        >
          {printing ? <LoaderCircleIcon className='animate-spin' /> : <PrinterIcon />}
          {printing ? 'Preparing PDF…' : 'Print payslip'}
        </Button>
      </div>
      <Card className='max-w-4xl'>
        <CardContent>
          <PayslipContent slip={slip} />
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title='Delete payslip?'
        description='Removes this employee from the unfinalized payrun. Recompute the remaining batch before validation.'
        confirmLabel='Delete payslip'
        variant='destructive'
        pending={deleting}
        onConfirm={async () => {
          setDeleting(true)
          const result = await usePayrollStore.getState().removePayslip(slip.id)
          setDeleting(false)
          if (!result.ok) {
            toast.error(result.error)
            return
          }
          toast.success('Payslip deleted')
          router.push(`/payroll/${result.id}`)
        }}
      />
    </div>
  )
}
