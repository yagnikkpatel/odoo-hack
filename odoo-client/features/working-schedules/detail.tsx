'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useSchedulesStore } from './store'
import ScheduleContent from './record-content'
import ScheduleEditor from './editor'
import ScheduleActions from './record-actions'
import WeekPattern from './week-pattern'

export default function ScheduleDetail({ id }: { id: string }) {
  const schedule = useSchedulesStore((state) =>
    state.schedules.find((schedule) => schedule.id === id),
  )
  const hydrated = useSchedulesStore((state) => state.hasHydrated)
  const [editing, setEditing] = useState(false)
  const { can } = useCurrentUser()
  const router = useRouter()
  if (!schedule)
    return hydrated ? (
      <RecordNotFound
        label="Working schedule"
        backHref="/attendance/schedules"
        backLabel="Working schedules"
      />
    ) : (
      <p role="status" className="py-8 text-sm">
        Loading schedule…
      </p>
    )
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to working schedules"
          render={<Link href="/attendance/schedules" />}
        >
          <ArrowLeftIcon />
        </Button>
        <h1 className="mr-auto min-w-0 truncate text-base font-semibold">
          {schedule.name}
        </h1>
        {can('records:update') && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Edit schedule
          </Button>
        )}
        <ScheduleActions
          schedule={schedule}
          detail
          onEdit={() => setEditing(true)}
          onDeleted={() => router.push('/attendance/schedules')}
        />
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card>
          <CardContent>
            <ScheduleContent schedule={schedule} />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardContent className="space-y-3">
            <h2 className="text-sm font-medium">Weekly calendar</h2>
            <WeekPattern schedule={schedule} />
          </CardContent>
        </Card>
      </div>
      {editing && (
        <ScheduleEditor
          schedule={schedule}
          onClose={() => setEditing(false)}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
