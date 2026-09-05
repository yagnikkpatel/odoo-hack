'use client'
import Link from 'next/link'
import { toast } from 'sonner'
import { ClockIcon } from 'lucide-react'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useSchedulesStore } from './store'

export default function EmployeeSchedule({
  employeeId,
}: {
  employeeId: string
}) {
  const schedules = useSchedulesStore((state) => state.schedules)
  const scheduleId = useSchedulesStore((state) => state.assignments[employeeId])
  const { can } = useCurrentUser()
  return (
    <>
      <RecordField
        type="select"
        label="Schedule"
        icon={ClockIcon}
        canEdit={can('records:update')}
        value={scheduleId || 'none'}
        options={[
          { value: 'none', label: 'Not assigned' },
          ...schedules.map((schedule) => ({
            value: schedule.id,
            label: schedule.name,
          })),
        ]}
        onChange={(value) => {
          const result = useSchedulesStore
            .getState()
            .assign(employeeId, value === 'none' ? undefined : value)
          if (!result.ok) toast.error(result.error)
        }}
      />
      {scheduleId && (
        <Link
          href={'/attendance/schedules/' + scheduleId}
          className="text-muted-foreground block py-1 text-right text-xs hover:underline"
        >
          View working pattern →
        </Link>
      )}
    </>
  )
}
