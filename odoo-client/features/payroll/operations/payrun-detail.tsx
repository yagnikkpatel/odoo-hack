'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeftIcon,
  CalculatorIcon,
  CheckIcon,
  LandmarkIcon,
  LoaderCircleIcon,
  SendIcon,
  Trash2Icon,
  WalletIcon
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card } from '@/features/nexacrm/components/ui/card'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/features/nexacrm/components/ui/table'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'
import { usePayrollPermissions } from '../permissions'
import { usePayrollStore } from '../store'
import { formatPeriod, formatTimestamp, isLocked, money } from '../types'
import type { PayrollWarning } from '../types'
import usePayrollData from '../components/use-payroll-data'
import PayrollStatusBadge from '../components/status-badge'
import PayrollWarnings from '../components/warnings'
import { AccessDenied } from '../components/list-page'
import BankDetailsDialog from '../components/bank-details-dialog'
import DeliveryDialog from '../delivery-dialog'

type Pending = 'compute' | 'validate' | 'paid' | 'delete' | null

export default function PayrunDetail({ id }: { id: string }) {
  usePayrollData()
  const router = useRouter()
  const run = usePayrollStore(state => state.payruns.find(item => item.id === id))
  const slips = usePayrollStore(state => state.payslips.filter(item => item.payrunId === id))
  const hydrated = usePayrollStore(state => state.hasHydrated)
  const loadError = usePayrollStore(state => state.error)
  const { canRead, canProcess, canDelete } = usePayrollPermissions()
  const [pending, setPending] = useState<Pending>(null)
  const [confirm, setConfirm] = useState<'validate' | 'paid' | 'delete' | null>(null)
  const [delivery, setDelivery] = useState(false)
  const [bank, setBank] = useState<{ id: string; name: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const sorted = useMemo(() => [...slips].sort((a, b) => a.employeeName.localeCompare(b.employeeName)), [slips])
  const warnings = useMemo<PayrollWarning[]>(
    () =>
      sorted.flatMap(slip =>
        slip.warnings.map(warning => ({ ...warning, message: `${slip.employeeName}: ${warning.message}` }))
      ),
    [sorted]
  )
  const missingBank = sorted.filter(slip => slip.warnings.some(warning => warning.code === 'bank'))

  if (!canRead) return <AccessDenied />
  if (!hydrated)
    return (
      <p role='status' className='py-8 text-sm'>
        Loading payrun…
      </p>
    )
  if (!run && loadError)
    return (
      <p role='alert' className='text-destructive py-8 text-sm'>
        {loadError}
      </p>
    )
  if (!run) return <RecordNotFound label='Payrun' backHref='/payroll' backLabel='Payruns' />

  const locked = isLocked(run.status)
  async function act(kind: Exclude<Pending, null>) {
    if (!run) return
    setPending(kind)
    setError(null)
    const store = usePayrollStore.getState()
    const result =
      kind === 'compute'
        ? await store.computePayrun(run.id)
        : kind === 'validate'
          ? await store.validatePayrun(run.id)
          : kind === 'paid'
            ? await store.markPaid(run.id)
            : await store.removePayrun(run.id)
    setPending(null)
    if (!result.ok) {
      setError(result.error)
      toast.error(result.error)
      return
    }
    toast.success(
      kind === 'compute'
        ? 'Payslips computed'
        : kind === 'validate'
          ? 'Payrun validated'
          : kind === 'paid'
            ? 'Payrun marked as paid'
            : 'Payrun deleted'
    )
    if (kind === 'delete') router.push('/payroll')
  }

  return (
    <div className='flex min-h-full flex-col'>
      <div className='flex flex-wrap items-center gap-2 border-b py-3'>
        <Button variant='ghost' size='icon-sm' aria-label='Back to payruns' render={<Link href='/payroll' />}>
          <ArrowLeftIcon />
        </Button>
        <WalletIcon className='size-4 text-rose-600' />
        <h1 className='mr-auto min-w-0 truncate text-base font-semibold tracking-tight'>{run.name}</h1>
        <PayrollStatusBadge status={run.status} />
        {canDelete && !locked && (
          <Button size='icon-sm' variant='ghost' aria-label='Delete payrun' onClick={() => setConfirm('delete')}>
            <Trash2Icon />
          </Button>
        )}
      </div>
      <div className='space-y-5 py-4'>
        {canProcess && (
          <div className='flex flex-wrap gap-2'>
            <Button size='sm' variant='outline' disabled={locked || pending !== null} onClick={() => act('compute')}>
              {pending === 'compute' ? <LoaderCircleIcon className='animate-spin' /> : <CalculatorIcon />}
              {run.status === 'computed' ? 'Recompute' : 'Compute'}
            </Button>
            <Button size='sm' variant='outline' disabled={run.status !== 'computed' || pending !== null} onClick={() => setConfirm('validate')}>
              <CheckIcon />
              Validate
            </Button>
            <Button size='sm' disabled={run.status !== 'validated' || pending !== null} onClick={() => setConfirm('paid')}>
              <WalletIcon />
              Mark paid
            </Button>
            <Button size='sm' variant='outline' disabled={!locked || pending !== null} onClick={() => setDelivery(true)}>
              <SendIcon />
              Send payslips
            </Button>
          </div>
        )}
        {error && (
          <p role='alert' className='text-destructive text-sm'>
            {error}
          </p>
        )}
        <Card className='grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4'>
          {[
            ['Salary structure', run.structureName],
            ['Payroll period', formatPeriod(run.startDate, run.endDate)],
            ['Employees', String(run.payslipCount)],
            ['Total net', run.status === 'draft' ? 'Awaiting computation' : money(run.totalNet)]
          ].map(([label, value]) => (
            <div key={label}>
              <p className='text-muted-foreground mb-1 text-xs'>{label}</p>
              <p className='text-sm font-medium tabular-nums'>{value}</p>
            </div>
          ))}
        </Card>
        {locked && (
          <p className='bg-muted/30 rounded-lg border px-4 py-3 text-sm'>
            {run.status === 'paid'
              ? `Payment recorded ${formatTimestamp(run.paidAt)}.`
              : `Validated ${formatTimestamp(run.validatedAt)}; ready for payment.`}{' '}
            Salary breakdowns, contract and bank snapshots are locked as payroll history.
            {run.sentAt && ` Payslips emailed ${formatTimestamp(run.sentAt)}.`}
          </p>
        )}
        <PayrollWarnings warnings={warnings} />
        {canProcess && !locked && missingBank.length > 0 && (
          <Card className='gap-3 p-4'>
            <h2 className='flex items-center gap-2 text-sm font-semibold'>
              <LandmarkIcon className='size-4' />
              Employee bank details
            </h2>
            <p className='text-muted-foreground text-xs'>Add the missing account, then recompute to clear the warning.</p>
            <div className='flex flex-wrap gap-2'>
              {missingBank.map(slip => (
                <Button key={slip.id} variant='outline' size='sm' onClick={() => setBank({ id: slip.employeeId, name: slip.employeeName })}>
                  Add bank details · {slip.employeeName}
                </Button>
              ))}
            </div>
          </Card>
        )}
        <section>
          <h2 className='mb-3 text-sm font-semibold'>
            Payslips <span className='text-muted-foreground font-normal'>({sorted.length})</span>
          </h2>
          <Card className='gap-0 overflow-hidden py-0'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead className='text-right'>Paid days</TableHead>
                  <TableHead className='text-right'>Gross</TableHead>
                  <TableHead className='text-right'>Deductions</TableHead>
                  <TableHead className='text-right'>Net</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map(slip => (
                  <TableRow key={slip.id}>
                    <TableCell>
                      <Link className='font-medium hover:underline' href={`/payslips/${slip.id}`}>
                        {slip.employeeName}
                      </Link>
                      {slip.warnings.length > 0 && (
                        <span className='ml-2 text-xs text-amber-700'>
                          {slip.warnings.length} warning{slip.warnings.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{slip.department || <span className='text-muted-foreground'>Not set</span>}</TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {slip.status === 'draft' ? '—' : `${slip.paidDays} / ${slip.periodDays}`}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>{slip.status === 'draft' ? '—' : money(slip.gross)}</TableCell>
                    <TableCell className='text-right tabular-nums'>{slip.status === 'draft' ? '—' : money(slip.deductions)}</TableCell>
                    <TableCell className='text-right font-medium tabular-nums'>{slip.status === 'draft' ? '—' : money(slip.net)}</TableCell>
                    <TableCell>
                      <PayrollStatusBadge status={slip.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {!sorted.length && (
                  <TableRow>
                    <TableCell colSpan={7} className='text-muted-foreground py-14 text-center'>
                      No payslips in this payrun.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
          {run.status === 'draft' && (
            <p className='text-muted-foreground mt-3 text-xs'>
              Compute applies the salary rules and the period contract to each selected employee.
            </p>
          )}
        </section>
      </div>
      {delivery && <DeliveryDialog run={run} slips={sorted} onClose={() => setDelivery(false)} />}
      {bank && (
        <BankDetailsDialog
          employeeId={bank.id}
          employeeName={bank.name}
          onClose={() => setBank(null)}
          onSaved={() => act('compute')}
        />
      )}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={open => {
          if (!open) setConfirm(null)
        }}
        title={confirm === 'delete' ? 'Delete payrun?' : confirm === 'paid' ? 'Record payroll payment?' : 'Validate payroll?'}
        description={
          confirm === 'delete'
            ? 'This removes the unfinalized batch and its payslips.'
            : confirm === 'paid'
              ? 'Records that salaries were paid outside this application. No money is transferred.'
              : 'Validation recomputes every payslip from live records, refuses if blocking warnings remain, and then locks the batch as payroll history.'
        }
        confirmLabel={confirm === 'delete' ? 'Delete payrun' : confirm === 'paid' ? 'Mark paid' : 'Validate payrun'}
        variant={confirm === 'delete' ? 'destructive' : 'default'}
        pending={pending !== null}
        onConfirm={async () => {
          const kind = confirm
          setConfirm(null)
          if (kind) await act(kind)
        }}
      />
    </div>
  )
}
