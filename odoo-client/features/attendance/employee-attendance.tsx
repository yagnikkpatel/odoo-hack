'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClockIcon, ExternalLinkIcon, PlusIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Calendar } from '@/features/nexacrm/components/ui/calendar'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/features/nexacrm/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/features/nexacrm/components/ui/table'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useAttendancePermissions } from './permissions'
import { listAttendances } from './service'
import { dateTimeLabel, hoursLabel, localDateTime } from './types'
import type { Attendance, AttendanceListResult } from './types'
import AttendanceStatusBadge from './status-badge'
import AttendanceEditor from './editor'

function dateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function EmployeeAttendanceLink({ employeeId }: { employeeId: string }) {
  const { user } = useCurrentUser()
  const { canReadAny } = useAttendancePermissions()
  if (!canReadAny && user.id !== employeeId) return null
  return (
    <Button
      variant="outline"
      size="sm"
      className="justify-start"
      render={
        <Link href={'/attendance?employee=' + encodeURIComponent(employeeId)} />
      }
    >
      <ClockIcon />
      <span>Attendance</span>
    </Button>
  )
}

export default function EmployeeAttendance({
  employeeId,
}: {
  employeeId: string
}) {
  const { user } = useCurrentUser()
  const { canReadAny, canCreate } = useAttendancePermissions()
  const allowed = canReadAny || user.id === employeeId
  const [view, setView] = useState('table')
  const [day, setDay] = useState<Date | undefined>(
    () => new Date(localDateTime().slice(0, 10) + 'T12:00:00'),
  )
  const [month, setMonth] = useState(
    () => new Date(localDateTime().slice(0, 10) + 'T12:00:00'),
  )
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<AttendanceListResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState('')
  const from = dateKey(new Date(month.getFullYear(), month.getMonth(), 1))
  const to = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0))
  const scope = canReadAny ? 'all' : 'own'
  const requestKey = `${employeeId}:${scope}:${view}:${page}:${from}:${to}:${revision}`

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    void listAttendances(
      {
        scope,
        employeeId: canReadAny ? employeeId : undefined,
        limit: view === 'calendar' ? 100 : 8,
        offset: view === 'calendar' ? 0 : page * 8,
        from: view === 'calendar' ? from : undefined,
        to: view === 'calendar' ? to : undefined,
      },
      controller.signal,
    )
      .then((value) => {
        if (controller.signal.aborted) return
        setResult(value)
        setError(null)
        setLoadedKey(requestKey)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Attendance could not be loaded.',
        )
        setLoadedKey(requestKey)
      })
    return () => controller.abort()
  }, [allowed, scope, canReadAny, employeeId, view, page, from, to, requestKey])

  if (!allowed)
    return (
      <p className="text-muted-foreground text-sm">
        You can only view your own attendance.
      </p>
    )
  const loading = loadedKey !== requestKey
  const records = result?.attendances || []
  const dayKey = day ? dateKey(day) : ''
  const visible =
    view === 'calendar'
      ? records.filter((record) => record.attendanceDate === dayKey)
      : records

  function renderTable(items: Attendance[]) {
    return (
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date / check in / out</TableHead>
              <TableHead>Worked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <Link
                    href={'/attendance/' + record.id}
                    className="block space-y-1 hover:underline"
                  >
                    <span className="block text-xs font-medium">
                      {record.attendanceDate}
                    </span>
                    <span className="block text-xs">
                      {record.checkIn
                        ? dateTimeLabel(record.checkIn)
                        : 'Not checked in'}
                    </span>
                    <span className="text-muted-foreground block text-xs">
                      {record.checkOut
                        ? dateTimeLabel(record.checkOut)
                        : 'Not checked out'}
                    </span>
                  </Link>
                  <div className="mt-1">
                    <AttendanceStatusBadge status={record.status} />
                  </div>
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {hoursLabel(record.workedHours * 60)}
                </TableCell>
              </TableRow>
            ))}
            {!items.length && (
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="text-muted-foreground py-6 text-center text-sm"
                >
                  No attendance records
                  {view === 'calendar' ? ' for the selected day' : ''}.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {!loading && !error
            ? `${result?.pagination.total || 0} attendance records${view === 'calendar' ? ' this month' : ''}`
            : 'Attendance records'}
        </span>
        {canCreate && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <PlusIcon />
            Add attendance
          </Button>
        )}
      </div>
      <Tabs value={view} onValueChange={setView} className="gap-3">
        <TabsList variant="line">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="space-y-3">
          <Calendar
            mode="single"
            selected={day}
            onSelect={setDay}
            month={month}
            onMonthChange={setMonth}
            weekStartsOn={1}
            className="mx-auto w-full rounded-lg border [--cell-size:--spacing(9)]"
            modifiers={{
              recorded:
                loading || error
                  ? []
                  : records.map(
                      (record) => new Date(record.attendanceDate + 'T12:00:00'),
                    ),
            }}
            modifiersClassNames={{
              recorded:
                'font-semibold underline decoration-primary decoration-2 underline-offset-4',
            }}
          />
          <p className="text-muted-foreground text-xs">
            Underlined dates have attendance. Select a day to see its record.
          </p>
        </TabsContent>
      </Tabs>
      {loading ? (
        <p role="status" className="text-muted-foreground py-4 text-sm">
          Loading attendance…
        </p>
      ) : error ? (
        <div className="space-y-2">
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRevision((value) => value + 1)}
          >
            Try again
          </Button>
        </div>
      ) : (
        renderTable(visible)
      )}
      {view === 'table' && (
        <div className="flex items-center justify-between text-xs">
          <Button
            size="sm"
            variant="ghost"
            disabled={loading || page === 0}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <span>
            Page {page + 1} of{' '}
            {Math.max(1, Math.ceil((result?.pagination.total || 0) / 8))}
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={loading || Boolean(error) || !result?.pagination.hasMore}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        Times shown in India Standard Time (Asia/Kolkata).
      </p>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        render={
          <Link
            href={'/attendance?employee=' + encodeURIComponent(employeeId)}
          />
        }
      >
        <ExternalLinkIcon />
        Open all attendance
      </Button>
      {creating && (
        <AttendanceEditor
          employeeId={employeeId}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setPage(0)
            setRevision((value) => value + 1)
          }}
        />
      )}
    </div>
  )
}
