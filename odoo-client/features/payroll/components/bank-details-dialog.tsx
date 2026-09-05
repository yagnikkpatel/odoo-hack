'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { EditorDialog, FormField } from '@/features/hr/components/form'
import { Input } from '@/features/nexacrm/components/ui/input'
import { getBankDetails } from '../service'
import { usePayrollStore } from '../store'
import type { BankDetailsInput } from '../types'

const EMPTY: BankDetailsInput = { accountHolder: '', accountNumber: '', ifsc: '', bankName: '', pan: '', uan: '' }

export default function BankDetailsDialog({
  employeeId,
  employeeName,
  onClose,
  onSaved
}: {
  employeeId: string
  employeeName: string
  onClose: () => void
  onSaved?: () => void
}) {
  const [draft, setDraft] = useState<BankDetailsInput>({ ...EMPTY, accountHolder: employeeName })
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    getBankDetails(employeeId)
      .then(existing => {
        if (active && existing) setDraft(existing)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [employeeId])
  const set = (value: Partial<BankDetailsInput>) => {
    setDraft(current => ({ ...current, ...value }))
    setError(null)
  }
  return (
    <EditorDialog
      title={`Bank details · ${employeeName}`}
      description='Salary is transferred to this account. PAN and UAN appear on the payslip when provided.'
      submitLabel='Save bank details'
      pending={pending || loading}
      error={error}
      onClose={onClose}
      onSubmit={async event => {
        event.preventDefault()
        setPending(true)
        const result = await usePayrollStore.getState().saveBankDetails(employeeId, draft)
        setPending(false)
        if (!result.ok) {
          setError(result.error)
          return
        }
        toast.success('Bank details saved')
        onSaved?.()
        onClose()
      }}
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField label='Account holder' id='bank-holder'>
          <Input id='bank-holder' maxLength={120} value={draft.accountHolder} onChange={e => set({ accountHolder: e.target.value })} />
        </FormField>
        <FormField label='Bank name' id='bank-name'>
          <Input id='bank-name' maxLength={120} value={draft.bankName} onChange={e => set({ bankName: e.target.value })} placeholder='HDFC Bank' />
        </FormField>
        <FormField label='Account number' id='bank-account'>
          <Input
            id='bank-account'
            required
            inputMode='numeric'
            pattern='[0-9]{9,18}'
            title='9 to 18 digits'
            value={draft.accountNumber}
            onChange={e => set({ accountNumber: e.target.value.replace(/\D/g, '') })}
            className='font-mono'
          />
        </FormField>
        <FormField label='IFSC' id='bank-ifsc'>
          <Input
            id='bank-ifsc'
            required
            maxLength={11}
            value={draft.ifsc}
            onChange={e => set({ ifsc: e.target.value.toUpperCase() })}
            placeholder='HDFC0001234'
            className='font-mono'
          />
        </FormField>
        <FormField label='PAN (optional)' id='bank-pan'>
          <Input
            id='bank-pan'
            maxLength={10}
            value={draft.pan}
            onChange={e => set({ pan: e.target.value.toUpperCase() })}
            placeholder='ABCDE1234F'
            className='font-mono'
          />
        </FormField>
        <FormField label='UAN (optional)' id='bank-uan'>
          <Input
            id='bank-uan'
            maxLength={12}
            inputMode='numeric'
            value={draft.uan}
            onChange={e => set({ uan: e.target.value.replace(/\D/g, '') })}
            placeholder='12 digit EPF UAN'
            className='font-mono'
          />
        </FormField>
      </div>
    </EditorDialog>
  )
}
