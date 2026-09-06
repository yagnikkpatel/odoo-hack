'use client'

import { useEffect, useState } from 'react'
import { Choice, EditorDialog, FormField } from '@/features/hr/components/form'
import { Input } from '@/features/nexacrm/components/ui/input'
import { listEligibleEmployees } from '../service'
import type { PayrollEmployeeOption, Payrun } from '../types'

export default function BankDetailsDialog({ run, initialEmployeeId = '', pending, error, onSave, onClose }: {
  run: Payrun
  initialEmployeeId?: string
  pending: boolean
  error: string | null
  onSave: (employeeId: string, account: string) => Promise<void>
  onClose: () => void
}) {
  const [employees, setEmployees] = useState<PayrollEmployeeOption[]>([])
  const [employeeId, setEmployeeId] = useState(initialEmployeeId)
  const [account, setAccount] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    // Payslips contain historical snapshots; read the current employee account.
    listEligibleEmployees(run.startDate, run.endDate, controller.signal).then(rows => {
      if (controller.signal.aborted) return
      const selected = rows.filter(row => run.employeeIds.includes(row.id))
      setEmployees(selected)
      setAccount(selected.find(row => row.id === initialEmployeeId)?.bankAccount ?? '')
    }).catch(cause => {
      if (!controller.signal.aborted) setLoadError(cause instanceof Error ? cause.message : 'Could not load bank details. Close and try again.')
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [run.startDate, run.endDate, run.employeeIds, initialEmployeeId])

  const employee = employees.find(row => row.id === employeeId)
  return <EditorDialog
    title="Employee bank details"
    description="Save the employee’s current account, then recompute the payrun to update its payslips and bank warnings."
    pending={pending || loading}
    error={error || loadError || validationError}
    submitLabel="Save bank details"
    onClose={() => { if (!pending) onClose() }}
    onSubmit={async event => {
      event.preventDefault()
      if (pending || loading || loadError) return
      if (!employee || account.trim().length < 4 || account.trim().length > 64) {
        setValidationError('Select an employee and enter a bank account between 4 and 64 characters.')
        return
      }
      setValidationError(null)
      await onSave(employee.id, account.trim())
    }}
  >
    {loading ? <p role="status" className="text-sm text-muted-foreground">Loading saved bank details…</p> : <>
      <FormField id="bank-employee" label="Employee">
        <Choice id="bank-employee" value={employeeId} searchable disabled={pending || !!loadError}
          placeholder="Select employee" options={employees.map(row => ({ value: row.id, label: row.name }))}
          onChange={id => { setEmployeeId(id); setAccount(employees.find(row => row.id === id)?.bankAccount ?? ''); setValidationError(null) }} />
      </FormField>
      {!loadError && !employees.length && <p className="text-sm text-muted-foreground">No employees have an active contract covering this payrun. Review their contracts before updating bank details.</p>}
      {employee && <FormField id="payroll-bank" label="Bank account / IBAN">
        <Input id="payroll-bank" required minLength={4} maxLength={64} autoComplete="off" disabled={pending || !!loadError}
          value={account} onChange={event => setAccount(event.target.value)} />
        <p className="text-xs text-muted-foreground">{employee.bankAccount ? 'Your saved account is shown above.' : 'No account is currently saved for this employee.'}</p>
      </FormField>}
    </>}
  </EditorDialog>
}
