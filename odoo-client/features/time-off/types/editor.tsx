'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Choice, EditorDialog, FormField } from '@/features/hr/components/form'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import { APPROVAL_LABELS, PAYROLL_LABELS, UNIT_LABELS } from '../model'
import type { TimeOffType, TimeOffTypeInput } from '../model'
import { useTimeOffStore } from '../store'

export default function TypeEditor({
  type,
  onClose,
  onSaved
}: {
  type?: TimeOffType
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [draft, setDraft] = useState<TimeOffTypeInput>(
    () =>
      type ?? {
        name: '',
        code: '',
        unit: 'days',
        requiresAllocation: true,
        approval: 'manager',
        payroll: 'paid',
        active: true,
        description: ''
      }
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const set = (patch: Partial<TimeOffTypeInput>) => {
    setDraft(previous => ({ ...previous, ...patch }))
    setError(null)
  }
  return (
    <EditorDialog
      title={type ? 'Edit time off type' : 'New time off type'}
      description='Define how leave is measured, approved, allocated and passed to payroll.'
      error={error}
      submitLabel={type ? 'Save changes' : 'Create type'}
      pending={submitting}
      onClose={onClose}
      onSubmit={async event => {
        event.preventDefault()
        setSubmitting(true)
        const result = await useTimeOffStore.getState().saveType(draft, type?.id)
        if (!result.ok) {
          setSubmitting(false)
          setError(result.error)
          return
        }
        toast.success(type ? 'Time off type updated' : 'Time off type created')
        onSaved(result.id)
        onClose()
      }}
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField id='leave-type-name' label='Name'>
          <Input
            id='leave-type-name'
            required
            autoFocus
            maxLength={100}
            value={draft.name}
            placeholder='Annual leave'
            onInput={event => set({ name: event.currentTarget.value })}
          />
        </FormField>
        <FormField id='leave-type-code' label='Code'>
          <Input
            id='leave-type-code'
            required
            maxLength={16}
            value={draft.code}
            placeholder='ANNUAL'
            onInput={event => set({ code: event.currentTarget.value.toUpperCase() })}
          />
        </FormField>
        <FormField id='leave-type-unit' label='Unit'>
          <Choice
            id='leave-type-unit'
            value={draft.unit}
            options={Object.entries(UNIT_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={value => set({ unit: value as TimeOffTypeInput['unit'] })}
          />
        </FormField>
        <FormField id='leave-type-allocation' label='Balance requirement'>
          <Choice
            id='leave-type-allocation'
            value={String(draft.requiresAllocation)}
            options={[
              { value: 'true', label: 'Approved allocation required' },
              { value: 'false', label: 'No allocation required' }
            ]}
            onChange={value => set({ requiresAllocation: value === 'true' })}
          />
        </FormField>
        <FormField id='leave-type-approval' label='Approval workflow'>
          <Choice
            id='leave-type-approval'
            value={draft.approval}
            options={Object.entries(APPROVAL_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={value => set({ approval: value as TimeOffTypeInput['approval'] })}
          />
        </FormField>
        <FormField id='leave-type-payroll' label='Payroll treatment'>
          <Choice
            id='leave-type-payroll'
            value={draft.payroll}
            options={Object.entries(PAYROLL_LABELS).map(([value, label]) => ({ value, label }))}
            onChange={value => set({ payroll: value as TimeOffTypeInput['payroll'] })}
          />
        </FormField>
        <FormField id='leave-type-active' label='Status'>
          <Choice
            id='leave-type-active'
            value={String(draft.active)}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Archived' }
            ]}
            onChange={value => set({ active: value === 'true' })}
          />
        </FormField>
      </div>
      <FormField id='leave-type-description' label='Policy notes'>
        <Textarea
          id='leave-type-description'
          value={draft.description}
          placeholder='Explain when employees can use this leave.'
          onChange={event => set({ description: event.target.value })}
        />
      </FormField>
      {type && (
        <p className='text-muted-foreground text-xs'>
          Rules already used by allocations or requests are protected to keep historical balances reliable. Archive a
          type to stop new requests.
        </p>
      )}
    </EditorDialog>
  )
}
