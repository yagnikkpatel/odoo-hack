'use client'
import { useState } from 'react'
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
import { useAttendanceStore } from './store'
import {
  attendanceStatus,
  dateTimeLabel,
  hoursLabel,
  localDateTime,
  workedMinutes,
} from './types'
import AttendanceStatusBadge from './status-badge'
import AttendanceEditor from './editor'

export function EmployeeAttendanceLink({ employeeId }: { employeeId: string }) {
  const count = useAttendanceStore(
    (state) =>
      state.records.filter((record) => record.employeeId === employeeId).length,
  )
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
      <span className="ml-auto text-xs tabular-nums">{count}</span>
    </Button>
  )
}

export default function EmployeeAttendance({
  employeeId,
}: {
  employeeId: string
}) {
  const records = useAttendanceStore((state) => state.records)
  const [day, setDay] = useState<Date | undefined>(() => new Date())
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const { can } = useCurrentUser()
  const scoped = records
    .filter((record) => record.employeeId === employeeId)
    .sort((a, b) => b.checkIn.localeCompare(a.checkIn))
  const dayKey = day ? localDateTime(day).slice(0, 10) : ''
  const selectedDay = scoped.filter(
    (record) => record.checkIn.slice(0, 10) === dayKey,
  )
  const pageIndex = Math.min(
    page,
    Math.max(0, Math.ceil(scoped.length / 8) - 1),
  )
  const renderTable = (items: typeof records) => (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Check in / out</TableHead>
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
                  <span className="block text-xs">
                    {dateTimeLabel(record.checkIn)}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {dateTimeLabel(record.checkOut)}
                  </span>
                </Link>
                <div className="mt-1">
                  <AttendanceStatusBadge status={attendanceStatus(record)} />
                </div>
              </TableCell>
              <TableCell className="text-xs tabular-nums">
                {hoursLabel(workedMinutes(record))}
              </TableCell>
            </TableRow>
          ))}
          {!items.length && (
            <TableRow>
              <TableCell
                colSpan={2}
                className="text-muted-foreground py-6 text-center text-sm"
              >
                No attendance entries{dayKey ? ' to show' : ''}.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {scoped.length} attendance entries
        </span>
        {can('records:create') && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <PlusIcon />
            Add attendance
          </Button>
        )}
      </div>
      <Tabs defaultValue="table" className="gap-3">
        <TabsList variant="line">
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="table" className="space-y-3">
          {renderTable(scoped.slice(pageIndex * 8, pageIndex * 8 + 8))}
          <div className="flex items-center justify-between text-xs">
            <Button
              size="sm"
              variant="ghost"
              disabled={pageIndex === 0}
              onClick={() => setPage(pageIndex - 1)}
            >
              Previous
            </Button>
            <span>
              {pageIndex + 1} / {Math.max(1, Math.ceil(scoped.length / 8))}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={(pageIndex + 1) * 8 >= scoped.length}
              onClick={() => setPage(pageIndex + 1)}
            >
              Next
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="calendar" className="space-y-3">
          <Calendar
            mode="single"
            selected={day}
            onSelect={setDay}
            weekStartsOn={1}
            className="mx-auto w-full rounded-lg border [--cell-size:--spacing(9)]"
            modifiers={{
              recorded: scoped.map((record) => new Date(record.checkIn)),
            }}
            modifiersClassNames={{
              recorded:
                'font-semibold underline decoration-primary decoration-2 underline-offset-4',
            }}
          />
          <p className="text-muted-foreground text-xs">
            Underlined dates have attendance. Select a day to see its entries.
          </p>
          {renderTable(selectedDay)}
        </TabsContent>
      </Tabs>
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
          onSaved={() => setPage(0)}
        />
      )}
    </div>
  )
}
