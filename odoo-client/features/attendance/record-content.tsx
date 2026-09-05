'use client'
import Link from 'next/link'
import { ClockIcon, CalendarIcon, UsersIcon } from 'lucide-react'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/features/nexacrm/components/ui/tabs'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import UserChip from '@/features/nexacrm/components/record/user-chip'
import { useEmployeesStore } from '@/features/employees/store'
import { employeeName } from '@/features/employees/types'
import { useSchedulesStore } from '@/features/working-schedules/store'
import { DAYS, slotMinutes } from '@/features/working-schedules/types'
import AttendanceStatusBadge from './status-badge'
import {
  attendanceStatus,
  dateTimeLabel,
  hoursLabel,
  workedMinutes,
} from './types'
import type { Attendance } from './types'

export default function AttendanceContent({ record }: { record: Attendance }) {
  const employee = useEmployeesStore((state) =>
    state.employees.find((employee) => employee.id === record.employeeId),
  )
  const schedules = useSchedulesStore((state) => state.schedules)
  const scheduleId = useSchedulesStore(
    (state) => state.assignments[record.employeeId],
  )
  const schedule = schedules.find((schedule) => schedule.id === scheduleId)
  const day = (new Date(record.checkIn).getDay() + 6) % 7
  const expected = schedule?.slots
    .filter((slot) => slot.day === day)
    .reduce((sum, slot) => sum + slotMinutes(slot), 0)
  return (
    <Tabs defaultValue="details" className="gap-4">
      <TabsList variant="line" className="w-full justify-start border-b">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger value="history">
          Corrections · {record.corrections.length}
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details" className="space-y-4">
        <RecordGroup title="Attendance">
          <RecordField type="static" label="Employee" icon={UsersIcon}>
            {employee ? (
              <Link
                className="text-sm hover:underline"
                href={'/employees/' + employee.id}
              >
                {employeeName(employee)}
              </Link>
            ) : (
              <span className="text-muted-foreground text-sm">
                Employee unavailable
              </span>
            )}
          </RecordField>
          <RecordField type="static" label="Check in" icon={CalendarIcon}>
            <span className="text-sm">{dateTimeLabel(record.checkIn)}</span>
          </RecordField>
          <RecordField type="static" label="Check out" icon={CalendarIcon}>
            <span className="text-sm">{dateTimeLabel(record.checkOut)}</span>
          </RecordField>
          <RecordField type="static" label="Break" icon={ClockIcon}>
            <span className="text-sm">{record.breakMinutes} minutes</span>
          </RecordField>
          <RecordField type="static" label="Worked hours" icon={ClockIcon}>
            <span className="text-sm font-medium tabular-nums">
              {hoursLabel(workedMinutes(record))}
            </span>
          </RecordField>
          <RecordField type="static" label="Status" icon={ClockIcon}>
            <AttendanceStatusBadge status={attendanceStatus(record)} />
          </RecordField>
        </RecordGroup>
        <RecordGroup title="Current working schedule">
          {schedule ? (
            <>
              <Link
                className="text-sm font-medium hover:underline"
                href={'/attendance/schedules/' + schedule.id}
              >
                {schedule.name}
              </Link>
              <p className="text-muted-foreground mt-1 text-xs">
                {DAYS[day]} · {hoursLabel(expected)} expected
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              No schedule assigned.
            </p>
          )}
          <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
            Current assignment for reference, not a historical payroll
            calculation. A blank calendar day does not automatically mean
            absence.
          </p>
        </RecordGroup>
        {record.note && (
          <RecordGroup title="Note">
            <p className="whitespace-pre-wrap break-words text-sm">
              {record.note}
            </p>
          </RecordGroup>
        )}
        <p className="text-muted-foreground text-xs">
          Recorded {dateTimeLabel(record.createdAt)}. Times use your device’s
          time zone.
        </p>
      </TabsContent>
      <TabsContent value="history" className="space-y-4">
        {!record.corrections.length && (
          <p className="text-muted-foreground py-4 text-sm">
            No manual corrections to this entry.
          </p>
        )}
        {[...record.corrections].reverse().map((change, index) => (
          <div
            key={change.at + index}
            className="space-y-2 rounded-lg border p-3"
          >
            <p className="text-sm font-medium">{change.reason}</p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
              {dateTimeLabel(change.at)}
              <UserChip userId={change.actorId} />
            </div>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Before</dt>
                <dd>
                  {dateTimeLabel(change.before.checkIn)} →{' '}
                  {dateTimeLabel(change.before.checkOut)} ·{' '}
                  {change.before.breakMinutes}m break
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">After</dt>
                <dd>
                  {dateTimeLabel(change.after.checkIn)} →{' '}
                  {dateTimeLabel(change.after.checkOut)} ·{' '}
                  {change.after.breakMinutes}m break
                </dd>
              </div>
              {change.before.employeeId !== change.after.employeeId && (
                <div>
                  <dt>Employee changed</dt>
                  <dd>
                    {change.before.employeeId} → {change.after.employeeId}
                  </dd>
                </div>
              )}
              {change.before.note !== change.after.note && (
                <div>
                  <dt>Note changed</dt>
                  <dd className="break-words">
                    {change.before.note || 'Empty'} →{' '}
                    {change.after.note || 'Empty'}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        ))}
      </TabsContent>
    </Tabs>
  )
}
