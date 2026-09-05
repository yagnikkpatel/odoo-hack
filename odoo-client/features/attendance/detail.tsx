'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'
import { useAttendanceStore } from './store'
import AttendanceContent from './record-content'
import AttendanceActions from './record-actions'
import AttendanceEditor from './editor'

export default function AttendanceDetail({ id }: { id: string }) {
  const record = useAttendanceStore((state) =>
    state.records.find((record) => record.id === id),
  )
  const hydrated = useAttendanceStore((state) => state.hasHydrated)
  const [editing, setEditing] = useState(false)
  const router = useRouter()
  if (!record)
    return hydrated ? (
      <RecordNotFound
        label="Attendance"
        backHref="/attendance"
        backLabel="Attendance"
      />
    ) : (
      <p role="status" className="py-8 text-sm">
        Loading attendance…
      </p>
    )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Back to attendance"
          render={<Link href="/attendance" />}
        >
          <ArrowLeftIcon />
        </Button>
        <h1 className="mr-auto text-base font-semibold">Attendance details</h1>
        <AttendanceActions
          record={record}
          detail
          onEdit={() => setEditing(true)}
          onDeleted={() => router.push('/attendance')}
        />
      </div>
      <Card className="max-w-3xl">
        <CardContent>
          <AttendanceContent record={record} />
        </CardContent>
      </Card>
      {editing && (
        <AttendanceEditor
          record={record}
          onClose={() => setEditing(false)}
          onSaved={() => {}}
        />
      )}
    </div>
  )
}
