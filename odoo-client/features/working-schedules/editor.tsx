'use client'
import { useState } from 'react'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { TimePicker } from '@/features/nexacrm/components/ui/time-picker'
import { FormField, Choice, EditorDialog } from '@/features/hr/components/form'
import { hoursLabel } from '@/features/attendance/types'
import { DAYS, SCHEDULE_TYPES, slotMinutes, weeklyMinutes } from './types'
import type { ScheduleInput, ScheduleSlot, WorkingSchedule } from './types'
import { useSchedulesStore } from './store'

export default function ScheduleEditor({
  schedule,
  onClose,
  onSaved,
}: {
  schedule?: WorkingSchedule
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [draft, setDraft] = useState<ScheduleInput>(() =>
    schedule
      ? { ...schedule, slots: schedule.slots.map((slot) => ({ ...slot })) }
      : {
          name: '',
          type: 'full-time',
          slots: [0, 1, 2, 3, 4].map((day) => ({
            day,
            start: '09:00',
            end: '18:00',
            breakMinutes: 60,
          })),
        },
  )
  const [error, setError] = useState<string | null>(null)
  const setSlot = (index: number, value: Partial<ScheduleSlot>) => {
    setDraft((current) => ({
      ...current,
      slots: current.slots.map((slot, position) =>
        position === index ? { ...slot, ...value } : slot,
      ),
    }))
    setError(null)
  }
  return (
    <EditorDialog
      title={schedule ? 'Edit working schedule' : 'New working schedule'}
      description="Define the weekly pattern. Hours are calculated after breaks. Split shifts can use multiple periods on a day."
      error={error}
      onClose={onClose}
      submitLabel="Save schedule"
      onSubmit={(event) => {
        event.preventDefault()
        const result = useSchedulesStore.getState().save(draft, schedule?.id)
        if (!result.ok) {
          setError(result.error)
          return
        }
        onSaved(result.id)
        onClose()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="schedule-name" label="Schedule name">
          <Input
            id="schedule-name"
            required
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="e.g. Standard work week"
          />
        </FormField>
        <FormField id="schedule-type" label="Type">
          <Choice
            id="schedule-type"
            value={draft.type}
            options={Object.entries(SCHEDULE_TYPES).map(([value, label]) => ({
              value,
              label,
            }))}
            onChange={(type) =>
              setDraft((current) => ({
                ...current,
                type: type as ScheduleInput['type'],
              }))
            }
          />
        </FormField>
      </div>
      <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
        <span className="text-muted-foreground text-sm">
          Total weekly hours
        </span>
        <output className="font-semibold tabular-nums">
          {hoursLabel(weeklyMinutes(draft))}
        </output>
      </div>
      <div className="space-y-3">
        {draft.slots.map((slot, index) => (
          <fieldset key={index} className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-xs font-medium">
              Period {index + 1} · {hoursLabel(slotMinutes(slot))}
            </legend>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <FormField id={'slot-day-' + index} label="Day">
                  <Choice
                    id={'slot-day-' + index}
                    value={String(slot.day)}
                    options={DAYS.map((label, value) => ({
                      value: String(value),
                      label,
                    }))}
                    onChange={(day) => setSlot(index, { day: Number(day) })}
                  />
                </FormField>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove period ${index + 1}`}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    slots: current.slots.filter(
                      (_, position) => position !== index,
                    ),
                  }))
                }
              >
                <Trash2Icon />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <FormField id={'slot-start-' + index} label="Start">
                <TimePicker
                  id={'slot-start-' + index}
                  required
                  value={slot.start}
                  onChange={(start) => setSlot(index, { start })}
                />
              </FormField>
              <FormField id={'slot-end-' + index} label="End">
                <TimePicker
                  id={'slot-end-' + index}
                  required
                  value={slot.end}
                  onChange={(end) => setSlot(index, { end })}
                />
              </FormField>
              <FormField id={'slot-break-' + index} label="Break (min)">
                <Input
                  id={'slot-break-' + index}
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={slot.breakMinutes}
                  onInput={(event) =>
                    setSlot(index, { breakMinutes: event.currentTarget.valueAsNumber })
                  }
                />
              </FormField>
            </div>
          </fieldset>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setDraft((current) => ({
            ...current,
            slots: [
              ...current.slots,
              { day: 0, start: '09:00', end: '18:00', breakMinutes: 60 },
            ],
          }))
        }
      >
        <PlusIcon />
        Add working period
      </Button>
      <p className="text-muted-foreground text-xs">
        Each working period must start and end on the same day. Overnight
        schedule patterns and historical versions will be handled with the
        backend.
      </p>
    </EditorDialog>
  )
}
