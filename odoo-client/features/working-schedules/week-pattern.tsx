import { DAYS, slotMinutes } from './types'
import type { WorkingSchedule } from './types'
import { hoursLabel } from '@/features/attendance/types'

export default function WeekPattern({
  schedule,
  compact = false,
}: {
  schedule: WorkingSchedule
  compact?: boolean
}) {
  return (
    <div
      className={compact ? 'space-y-2' : 'overflow-x-auto rounded-lg border'}
    >
      <div className={compact ? 'space-y-2' : 'grid min-w-[770px] grid-cols-7'}>
        {DAYS.map((day, index) => {
          const slots = schedule.slots
            .filter((slot) => slot.day === index)
            .sort((a, b) => a.start.localeCompare(b.start))
          return (
            <div
              key={day}
              className={
                compact
                  ? 'grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 border-b py-2 last:border-0'
                  : 'min-h-28 space-y-2 border-r p-2.5 last:border-r-0'
              }
            >
              <p className="text-muted-foreground text-xs font-medium">{day}</p>
              <div className="space-y-2">
                {slots.map((slot, index) => (
                  <div
                    key={index}
                    className="rounded-md border bg-muted/20 px-2 py-1.5"
                  >
                    <p className="text-xs font-medium tabular-nums">
                      {slot.start} – {slot.end}
                    </p>
                    <p className="text-muted-foreground text-[11px]">
                      {slot.breakMinutes}m break ·{' '}
                      {hoursLabel(slotMinutes(slot))}
                    </p>
                  </div>
                ))}
                {!slots.length && (
                  <p className="text-muted-foreground text-xs">Day off</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
