'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Choice, EditorDialog, FormField } from '@/features/hr/components/form'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import { DatePicker } from '@/features/nexacrm/components/ui/date-picker'
import { dateValue } from '@/features/nexacrm/lib/date-time'
import { useEmployeeOptions } from '@/features/hr/employee-options'
import type { Allocation, AllocationInput } from '../model'
import { useTimeOffStore } from '../store'

export default function AllocationEditor({
  allocation,
  employeeId = '',
  typeId = '',
  onClose,
  onSaved
}: {
  allocation?: Allocation
  employeeId?: string
  typeId?: string
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const { employees, loading: employeesLoading, error: employeesError, reload: reloadEmployees } = useEmployeeOptions()
  const types = useTimeOffStore(state => state.types)
  const [draft, setDraft] = useState<AllocationInput>(
    () =>
      allocation ?? {
        employeeId,
        typeId: types.some(type => type.id === typeId && type.active && type.requiresAllocation) ? typeId : '',
        amount: 0,
        validFrom: dateValue(new Date()),
        validTo: '',
        note: ''
      }
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const set = (patch: Partial<AllocationInput>) => {
    setDraft(previous => ({ ...previous, ...patch }))
    setError(null)
  }
  const type = types.find(item => item.id === draft.typeId)
  const availableTypes = types.filter(
    item => (item.active && item.requiresAllocation) || item.id === allocation?.typeId
  )
  return (
    <EditorDialog
      title={allocation ? 'Edit allocation' : 'New allocation'}
      description='Assign a leave balance to an employee. It becomes available only after approval.'
      submitLabel={
        allocation?.status === 'refused' ? 'Resubmit for approval' : allocation ? 'Save changes' : 'Submit for approval'
      }
      error={error}
      pending={submitting}
      onClose={onClose}
      onSubmit={async event => {
        event.preventDefault()
        setSubmitting(true)
        const result = await useTimeOffStore.getState().saveAllocation(draft, allocation?.id)
        if (!result.ok) {
          setSubmitting(false)
          setError(result.error)
          return
        }
        toast.success(allocation ? 'Allocation updated' : 'Allocation submitted for approval')
        onSaved(result.id)
        onClose()
      }}
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField id='allocation-employee' label='Employee'>
          {employeesError ? (
            <p className='text-destructive text-sm'>
              {employeesError}{' '}
              <button type='button' className='underline' onClick={reloadEmployees}>
                Retry
              </button>
            </p>
          ) : (
            <Choice
              id='allocation-employee'
              value={draft.employeeId}
              searchable
              disabled={employeesLoading}
              placeholder={employeesLoading ? 'Loading employees…' : 'Choose…'}
              options={employees.map(employee => ({ value: employee.id, label: employee.name }))}
              onChange={value => set({ employeeId: value })}
            />
          )}
        </FormField>
        <FormField id='allocation-type' label='Time off type'>
          <Choice
            id='allocation-type'
            value={draft.typeId}
            options={availableTypes.map(item => ({ value: item.id, label: item.name }))}
            onChange={value => set({ typeId: value })}
          />
        </FormField>
        <FormField id='allocation-amount' label={type ? `Amount (${type.unit})` : 'Amount'}>
          <Input
            id='allocation-amount'
            type='number'
            inputMode='decimal'
            min='0.01'
            max='100000'
            step='0.01'
            required
            value={Number.isNaN(draft.amount) ? '' : draft.amount || ''}
            placeholder='Enter balance'
            onInput={event => set({ amount: event.currentTarget.valueAsNumber })}
          />
        </FormField>
        <div className='text-muted-foreground self-end pb-1 text-xs'>
          Only active types that require an allocation can receive new balances.
        </div>
        <FormField id='allocation-from' label='Valid from'>
          <DatePicker
            id='allocation-from'
            label='Valid from'
            required
            value={draft.validFrom}
            min='1900-01-01'
            max={draft.validTo || '2100-12-31'}
            onChange={value => set({ validFrom: value })}
          />
        </FormField>
        <FormField id='allocation-to' label='Valid until (optional)'>
          <DatePicker
            id='allocation-to'
            label='Valid until'
            value={draft.validTo}
            min={draft.validFrom || '1900-01-01'}
            max='2100-12-31'
            placeholder='No expiry'
            onChange={value => set({ validTo: value })}
          />
        </FormField>
      </div>
      <FormField id='allocation-note' label='Notes'>
        <Textarea
          id='allocation-note'
          value={draft.note}
          placeholder='For example, annual entitlement or a balance adjustment.'
          onChange={event => set({ note: event.target.value })}
        />
      </FormField>
      {!availableTypes.length && (
        <p className='text-muted-foreground text-sm'>
          Create an active time off type with an allocation requirement before assigning a balance.
        </p>
      )}
      <p className='text-muted-foreground text-xs'>
        Validity includes both start and end dates. Approved requests automatically reduce the remaining balance for
        their applicable dates.
      </p>
    </EditorDialog>
  )
}
