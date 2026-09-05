'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'
import { useAttendanceRecord } from './use-attendance-record'
import AttendanceContent from './record-content'
import AttendanceActions from './record-actions'
import AttendanceEditor from './editor'

export default function AttendanceDetail({ id }: { id: string }) {
  const { record, loading, error, retry } = useAttendanceRecord(id)
  const [editing, setEditing] = useState(false)
  if (error)
    return (
      <div className="space-y-3 py-8">
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
        <Button variant="outline" onClick={retry}>
          Try again
        </Button>
        <Button variant="ghost" render={<Link href="/attendance" />}>
          Back to attendance
        </Button>
      </div>
    )
  if (!record)
    return !loading ? (
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
        <AttendanceActions onEdit={() => setEditing(true)} />
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
