'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import { DatePicker } from '@/features/nexacrm/components/ui/date-picker'
import { DateTimePicker } from '@/features/nexacrm/components/ui/date-time-picker'
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/nexacrm/components/ui/dialog'
import { FormField, Choice } from '@/features/hr/components/form'
import { useAttendanceStore } from './store'
import { useAttendancePermissions } from './permissions'
import { listAttendanceEmployees } from './service'
import {
  ATTENDANCE_STATUSES,
  localDateTime,
  toAttendanceTimestamp,
} from './types'
import type { Attendance, AttendanceStatus } from './types'

type Draft = {
  employeeId: string
  attendanceDate: string
  checkIn: string
  checkOut: string
  overtime: string
  status: AttendanceStatus | 'automatic'
  editReason: string
}

function initialDraft(record?: Attendance, employeeId?: string): Draft {
  return {
    employeeId: record?.employeeId || employeeId || '',
    attendanceDate: record?.attendanceDate || localDateTime().slice(0, 10),
    checkIn: record?.checkIn
      ? localDateTime(new Date(record.checkIn))
      : record
        ? ''
        : localDateTime(),
    checkOut: record?.checkOut ? localDateTime(new Date(record.checkOut)) : '',
    overtime: String(record?.overtimeHours || 0),
    status: record?.status || 'automatic',
    editReason: '',
  }
}

function timestamp(value: string, original?: string | null) {
  if (!value) return undefined
  // Preserve seconds.
  if (original && value === localDateTime(new Date(original))) return original
  return toAttendanceTimestamp(value)
}

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
  const [draft, setDraft] = useState(() => initialDraft(record, employeeId))
  const [employees, setEmployees] = useState<
    { id: string; name: string; email: string }[]
  >([])
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const [employeesLoading, setEmployeesLoading] = useState(!record)
  const [employeeAttempt, setEmployeeAttempt] = useState(0)
  const save = useAttendanceStore((state) => state.save)
  const { canCreate, canUpdate } = useAttendancePermissions()

  useEffect(() => {
    if (record || !canCreate) return
    let active = true
    void listAttendanceEmployees()
      .then((items) => {
        if (active) setEmployees(items)
      })
      .catch((cause) => {
        if (active)
          setEmployeeError(
            cause instanceof Error
              ? cause.message
              : 'Employees could not be loaded.',
          )
      })
      .finally(() => {
        if (active) setEmployeesLoading(false)
      })
    return () => {
      active = false
    }
  }, [record, canCreate, employeeAttempt])

  function set(value: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...value }))
  }

  const [result, formAction, pending] = useActionState(
    async () => {
      try {
        if (!(record ? canUpdate : canCreate))
          throw new Error('You do not have permission to save attendance.')
        if (!draft.employeeId) throw new Error('Select an employee.')
        if (!draft.attendanceDate)
          throw new Error('Select the attendance date.')
        const checkIn = timestamp(draft.checkIn, record?.checkIn)
        const checkOut = timestamp(draft.checkOut, record?.checkOut)
        if (checkOut && !checkIn)
          throw new Error('Add a check-in before a check-out.')
        if (checkIn && checkOut) {
          const duration =
            new Date(checkOut).getTime() - new Date(checkIn).getTime()
          if (duration <= 0)
            throw new Error('Check-out must be after check-in.')
          if (duration > 24 * 60 * 60 * 1000)
            throw new Error('An attendance record cannot exceed 24 hours.')
        }
        if (
          [checkIn, checkOut].some(
            (value) => value && new Date(value).getTime() > Date.now(),
          )
        ) {
          throw new Error('Check-in and check-out cannot be in the future.')
        }
        const overtimeHours = Number(draft.overtime)
        if (
          !draft.overtime.trim() ||
          !Number.isFinite(overtimeHours) ||
          overtimeHours < 0 ||
          overtimeHours > 24
        ) {
          throw new Error('Overtime must be between 0 and 24 hours.')
        }
        const id = await save(
          {
            employeeId: draft.employeeId,
            attendanceDate: draft.attendanceDate,
            checkIn,
            checkOut,
            overtimeHours,
            status: draft.status === 'automatic' ? undefined : draft.status,
            editReason:
              record && draft.editReason.trim()
                ? draft.editReason.trim()
                : undefined,
          },
          record?.id,
        )
        onSaved(id)
        onClose()
        return { error: null }
      } catch (cause) {
        return {
          error:
            cause instanceof Error
              ? cause.message
              : 'Attendance could not be saved. Please try again.',
        }
      }
    },
    { error: null },
  )

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
        showCloseButton={!pending}
      >
        <DialogHeader className="shrink-0 border-b p-5 pr-12">
          <DialogTitle>
            {record ? 'Correct attendance' : 'New attendance'}
          </DialogTitle>
          <DialogDescription>
            Record attendance in India Standard Time (IST).
          </DialogDescription>
        </DialogHeader>
        <form
          action={formAction}
          className="flex min-h-0 flex-col overflow-hidden"
        >
          <div
            data-testid="attendance-form-body"
            className="min-h-0 overflow-y-auto p-5"
          >
            <fieldset disabled={pending} className="min-w-0 space-y-5">
              <FormField id="attendance-employee" label="Employee">
                {record ? (
                  <Input
                    id="attendance-employee"
                    value={`${record.employeeName} · ${record.employeeEmail}`}
                    disabled
                  />
                ) : employeesLoading ? (
                  <p role="status" className="text-muted-foreground text-sm">
                    Loading employees…
                  </p>
                ) : (
                  <Choice
                    id="attendance-employee"
                    value={draft.employeeId}
                    options={employees.map((employee) => ({
                      value: employee.id,
                      label: `${employee.name} · ${employee.email}`,
                    }))}
                    onChange={(employeeId) => set({ employeeId })}
                  />
                )}
              </FormField>
              {employeeError && (
                <div className="space-y-2">
                  <p role="alert" className="text-destructive text-sm">
                    {employeeError}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEmployeeError(null)
                      setEmployeesLoading(true)
                      setEmployeeAttempt((value) => value + 1)
                    }}
                  >
                    Retry employees
                  </Button>
                </div>
              )}
              <FormField id="attendance-date" label="Attendance date">
                <DatePicker
                  id="attendance-date"
                  label="Attendance date"
                  required
                  disabled={Boolean(record)}
                  value={draft.attendanceDate}
                  onChange={(attendanceDate) => set({ attendanceDate })}
                />
              </FormField>
              <div className="space-y-2">
                <div className="grid items-start gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <div className="flex min-h-7 items-center justify-between gap-2">
                      <Label htmlFor="attendance-in">Check in</Label>
                      {draft.checkIn && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground h-7 px-2 text-xs"
                          aria-label="Clear check-in and check-out"
                          onClick={() => set({ checkIn: '', checkOut: '' })}
                        >
                          Clear times
                        </Button>
                      )}
                    </div>
                    <DateTimePicker
                      id="attendance-in"
                      label="Check in"
                      timePlaceholder="Time"
                      value={draft.checkIn}
                      onChange={(checkIn) => set({ checkIn })}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <div className="flex min-h-7 items-center justify-between gap-2">
                      <Label htmlFor="attendance-out">Check out</Label>
                      {draft.checkOut && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground h-7 px-2 text-xs"
                          aria-label="Clear check-out"
                          onClick={() => set({ checkOut: '' })}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <DateTimePicker
                      id="attendance-out"
                      label="Check out"
                      timePlaceholder="Time"
                      value={draft.checkOut}
                      onChange={(checkOut) => set({ checkOut })}
                    />
                  </div>
                </div>
                <p className="text-muted-foreground text-xs">
                  Times are optional. Leave both blank to record an absence.
                </p>
              </div>
              <div className="grid items-start gap-4 sm:grid-cols-2">
                <FormField id="attendance-overtime" label="Overtime (hours)">
                  <Input
                    id="attendance-overtime"
                    type="number"
                    required
                    min={0}
                    max={24}
                    step="any"
                    value={draft.overtime}
                    onChange={(event) => set({ overtime: event.target.value })}
                  />
                </FormField>
                <FormField id="attendance-status" label="Status">
                  <Choice
                    id="attendance-status"
                    value={draft.status}
                    options={[
                      { value: 'automatic', label: 'Automatic from times' },
                      ...Object.entries(ATTENDANCE_STATUSES).map(
                        ([value, label]) => ({ value, label }),
                      ),
                    ]}
                    onChange={(value) => {
                      const status = value as Draft['status']
                      // Marking present manually should also record the
                      // check-out that makes it true, so the table doesn't
                      // show "Present" alongside a blank check-out. Anchor
                      // the default 8-hour shift to the check-in itself
                      // (clamped to now) instead of the real current time —
                      // using "now" unconditionally could put the gap over
                      // 24h for an old check-in and trip the duration guard
                      // in formAction below, silently blocking the save.
                      let checkOut = draft.checkOut
                      if (status === 'present' && draft.checkIn && !draft.checkOut) {
                        const checkInMs = new Date(`${draft.checkIn}:00+05:30`).getTime()
                        const defaultCheckOutMs = Math.min(
                          checkInMs + 8 * 60 * 60 * 1000,
                          Date.now(),
                        )
                        checkOut = localDateTime(new Date(defaultCheckOutMs))
                      }
                      set({ status, checkOut })
                    }}
                  />
                </FormField>
              </div>
              {record && (
                <FormField
                  id="attendance-reason"
                  label="Correction reason (optional)"
                >
                  <Textarea
                    id="attendance-reason"
                    maxLength={500}
                    value={draft.editReason}
                    onChange={(event) =>
                      set({ editReason: event.target.value })
                    }
                    placeholder="Explain what changed and why…"
                  />
                </FormField>
              )}
            </fieldset>
          </div>
          {result.error && (
            <p
              role="alert"
              className="text-destructive shrink-0 px-5 pb-4 text-sm"
            >
              {result.error}
            </p>
          )}
          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none px-5 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <SubmitButton
              editing={Boolean(record)}
              disabled={!record && (employeesLoading || Boolean(employeeError))}
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SubmitButton({
  editing,
  disabled,
}: {
  editing: boolean
  disabled: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending || disabled}>
      {pending && <LoaderCircleIcon className="animate-spin" />}
      {pending ? 'Saving…' : editing ? 'Save correction' : 'Create attendance'}
    </Button>
  )
}
