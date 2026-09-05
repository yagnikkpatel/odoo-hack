'use client'
import { useState } from 'react'
import { Input } from '@/features/nexacrm/components/ui/input'
import { DateTimePicker } from '@/features/nexacrm/components/ui/date-time-picker'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import { FormField, Choice, EditorDialog } from '@/features/hr/components/form'
import { useEmployeesStore } from '@/features/employees/store'
import { employeeName } from '@/features/employees/types'
import { useAttendanceStore } from './store'
import { localDateTime, hoursLabel, workedMinutes } from './types'
import type { Attendance, AttendanceInput } from './types'

export default function AttendanceEditor({
  record,
  employeeId,
  onClose,
  onSaved,
}: {
  record?: Attendance
  employeeId?: string
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const employees = useEmployeesStore((state) => state.employees)
  const save = useAttendanceStore((state) => state.save)
  const [draft, setDraft] = useState<AttendanceInput>(() =>
    record
      ? { ...record }
      : {
          employeeId: employeeId || '',
          checkIn: localDateTime(),
          checkOut: '',
          breakMinutes: 0,
          note: '',
        },
  )
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const set = (value: Partial<AttendanceInput>) => {
    setDraft((current) => ({ ...current, ...value }))
    setError(null)
  }
  return (
    <EditorDialog
      title={record ? 'Correct attendance' : 'New attendance'}
      description={
        record
          ? 'The original values and your reason are preserved in correction history.'
          : 'Record a check-in, or add a completed attendance entry. Times use your device’s time zone.'
      }
      submitLabel={record ? 'Save correction' : 'Create attendance'}
      error={error}
      onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault()
        const result = save(draft, record?.id, reason)
        if (!result.ok) {
          setError(result.error)
          return
        }
        onSaved(result.id)
        onClose()
      }}
    >
      <FormField id="attendance-employee" label="Employee">
        <Choice
          id="attendance-employee"
          value={draft.employeeId}
          options={employees.map((employee) => ({
            value: employee.id,
            label: employeeName(employee),
          }))}
          onChange={(employeeId) => set({ employeeId })}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="attendance-in" label="Check in">
          <DateTimePicker
            id="attendance-in"
            label="Check in"
            required
            value={draft.checkIn}
            onChange={(checkIn) => set({ checkIn })}
          />
        </FormField>
        <FormField id="attendance-out" label="Check out (optional)">
          <DateTimePicker
            id="attendance-out"
            label="Check out"
            value={draft.checkOut || ''}
            onChange={(checkOut) => set({ checkOut })}
          />
        </FormField>
        <FormField id="attendance-break" label="Break (minutes)">
          <Input
            id="attendance-break"
            type="number"
            min={0}
            step={1}
            required
            value={draft.breakMinutes}
            onInput={(event) =>
              set({ breakMinutes: event.currentTarget.valueAsNumber })
            }
          />
        </FormField>
        <div className="grid content-center gap-1 rounded-lg border px-3 py-2">
          <span className="text-muted-foreground text-xs">
            Worked hours · calculated
          </span>
          <span className="text-sm font-medium tabular-nums">
            {hoursLabel(workedMinutes(draft))}
          </span>
        </div>
      </div>
      <FormField id="attendance-note" label="Note (optional)">
        <Textarea
          id="attendance-note"
          value={draft.note}
          onChange={(event) => set({ note: event.target.value })}
        />
      </FormField>
      {record && (
        <FormField id="attendance-reason" label="Correction reason">
          <Textarea
            id="attendance-reason"
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Explain what changed and why…"
          />
        </FormField>
      )}
    </EditorDialog>
  )
}
