'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Choice, EditorDialog, FormField } from '@/features/hr/components/form'
import { DatePicker } from '@/features/nexacrm/components/ui/date-picker'
import { TimePicker } from '@/features/nexacrm/components/ui/time-picker'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import { dateValue } from '@/features/nexacrm/lib/date-time'
import { useEmployeesStore } from '@/features/employees/store'
import { employeeName } from '@/features/employees/types'
import { useSchedulesStore } from '@/features/working-schedules/store'
import { useTimeOffStore } from '../store'
import { APPROVAL_LABELS, PAYROLL_LABELS } from '../model'
import type { RequestInput, TimeOffRequest } from '../model'
import { calculateRequest, formatAmount } from '../logic'
import RequestBalance from './balance-summary'

export default function RequestEditor({
  record,
  employeeId,
  typeId,
  onClose,
  onSaved
}: {
  record?: TimeOffRequest
  employeeId?: string
  typeId?: string
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const employees = useEmployeesStore(state => state.employees)
  const state = useTimeOffStore()
  const schedules = useSchedulesStore(state => state.schedules)
  const assignments = useSchedulesStore(state => state.assignments)
  const [draft, setDraft] = useState<RequestInput>(() =>
    record
      ? {
          employeeId: record.employeeId,
          typeId: record.typeId,
          startDate: record.startDate,
          endDate: record.endDate,
          startTime: record.startTime,
          endTime: record.endTime,
          reason: record.reason
        }
      : {
          employeeId: employeeId || employees[0]?.id || '',
          typeId: typeId || state.types.find(type => type.active)?.id || '',
          startDate: dateValue(new Date()),
          endDate: dateValue(new Date()),
          startTime: '09:00',
          endTime: '10:00',
          reason: ''
        }
  )
  const [error, setError] = useState<string | null>(null)
  const type = state.types.find(type => type.id === draft.typeId)
  const schedule = schedules.find(schedule => schedule.id === assignments[draft.employeeId])
  const preview = state.previewRequest(draft)
  // Keep the requested duration visible even if allocation coverage is insufficient.
  const duration = preview.ok
    ? preview
    : calculateRequest(draft, state, { employeeIds: employees.map(employee => employee.id), schedules, assignments })
  const update = (patch: Partial<RequestInput>) => {
    setDraft(current => ({ ...current, ...patch }))
    setError(null)
  }
  return (
    <EditorDialog
      title={record ? 'Edit time off request' : 'New time off request'}
      description={
        record
          ? 'Changes resubmit this request using the current leave rules.'
          : 'Choose an employee, leave type and dates. Availability is checked again when approved.'
      }
      submitLabel={type?.approval === 'none' ? 'Submit and approve' : record ? 'Resubmit request' : 'Submit request'}
      error={error}
      onClose={onClose}
      onSubmit={event => {
        event.preventDefault()
        const result = useTimeOffStore.getState().saveRequest(draft, record?.id)
        if (!result.ok) {
          setError(result.error)
          return
        }
        toast.success(type?.approval === 'none' ? 'Time off approved' : 'Request submitted for approval')
        onSaved(result.id)
        onClose()
      }}
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField label='Employee' id='request-employee'>
          <Choice
            id='request-employee'
            value={draft.employeeId}
            options={employees.map(employee => ({ value: employee.id, label: employeeName(employee) }))}
            onChange={employeeId => update({ employeeId })}
          />
        </FormField>
        <FormField label='Time off type' id='request-type'>
          <Choice
            id='request-type'
            value={draft.typeId}
            options={state.types
              .filter(type => type.active || type.id === record?.typeId)
              .map(type => ({ value: type.id, label: type.name + (type.active ? '' : ' (inactive)') }))}
            onChange={typeId => {
              const nextType = state.types.find(type => type.id === typeId)
              update({ typeId, ...(nextType?.unit === 'hours' ? { endDate: draft.startDate } : {}) })
            }}
          />
        </FormField>
      </div>
      {type && (
        <p className='text-muted-foreground text-xs'>
          {PAYROLL_LABELS[type.payroll]} · {APPROVAL_LABELS[type.approval]} ·{' '}
          {type.requiresAllocation ? 'Approved allocation required' : 'No allocation required'}
        </p>
      )}
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField label={type?.unit === 'hours' ? 'Date' : 'From'} id='request-start-date'>
          <DatePicker
            id='request-start-date'
            value={draft.startDate}
            required
            onChange={startDate =>
              update({
                startDate,
                ...(type?.unit === 'hours' || draft.endDate < startDate ? { endDate: startDate } : {})
              })
            }
          />
        </FormField>
        {type?.unit !== 'hours' && (
          <FormField label='To (inclusive)' id='request-end-date'>
            <DatePicker
              id='request-end-date'
              value={draft.endDate}
              min={draft.startDate}
              required
              onChange={endDate => update({ endDate })}
            />
          </FormField>
        )}
      </div>
      {type?.unit === 'hours' && (
        <div className='grid grid-cols-2 gap-4'>
          <FormField label='Start time' id='request-start-time'>
            <TimePicker
              id='request-start-time'
              required
              value={draft.startTime}
              onChange={startTime => update({ startTime })}
            />
          </FormField>
          <FormField label='End time' id='request-end-time'>
            <TimePicker
              id='request-end-time'
              required
              value={draft.endTime}
              onChange={endTime => update({ endTime })}
            />
          </FormField>
        </div>
      )}
      <div className='bg-muted/40 space-y-1 rounded-lg border p-3'>
        <p className='flex justify-between gap-3 text-sm'>
          <span>Requested time</span>
          <span className='font-medium tabular-nums' aria-live='polite'>
            {duration.ok ? formatAmount(duration.duration, duration.unit) : '—'}
          </span>
        </p>
        {!preview.ok && (
          <p role='status' className='text-muted-foreground text-xs'>
            {preview.error}
          </p>
        )}
        <p className='text-muted-foreground text-xs leading-relaxed'>
          {type?.unit === 'hours'
            ? `Hours must fit one working period and cannot exceed the day’s net hours. ${schedule ? `Uses ${schedule.name}.` : 'No schedule assigned: uses Monday–Friday, 09:00–18:00 with a one-hour break.'} Times are local.`
            : schedule
              ? `Working days follow ${schedule.name}. Non-working days do not use leave.`
              : 'No working schedule assigned: Monday–Friday is used. Non-working days do not use leave.'}
        </p>
      </div>
      <RequestBalance employeeId={draft.employeeId} typeId={draft.typeId} asOf={draft.startDate} />
      <FormField label='Reason' id='request-reason'>
        <Textarea
          id='request-reason'
          required
          value={draft.reason}
          onChange={event => update({ reason: event.target.value })}
          placeholder='Add context for the approver…'
          maxLength={2000}
          rows={3}
        />
      </FormField>
    </EditorDialog>
  )
}
