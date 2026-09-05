'use client'

import { CalendarIcon, ClockIcon, UsersIcon } from 'lucide-react'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import AttendanceStatusBadge from './status-badge'
import { dateTimeLabel, hoursLabel } from './types'
import type { Attendance } from './types'

export default function AttendanceContent({ record }: { record: Attendance }) {
  return (
    <div className="space-y-5">
      <RecordGroup title="Attendance">
        <RecordField type="static" label="Employee" icon={UsersIcon}>
          <div className="min-w-0 text-sm">
            <p>{record.employeeName}</p>
            <p className="text-muted-foreground break-words text-xs">
              {record.employeeEmail}
            </p>
          </div>
        </RecordField>
        <RecordField type="static" label="Attendance date" icon={CalendarIcon}>
          <span className="text-sm">{record.attendanceDate}</span>
        </RecordField>
        <RecordField type="static" label="Check in" icon={ClockIcon}>
          <span className="text-sm">
            {record.checkIn ? dateTimeLabel(record.checkIn) : 'Not checked in'}
          </span>
        </RecordField>
        <RecordField type="static" label="Check out" icon={ClockIcon}>
          <span className="text-sm">
            {record.checkOut
              ? dateTimeLabel(record.checkOut)
              : 'Not checked out'}
          </span>
        </RecordField>
        <RecordField type="static" label="Worked hours" icon={ClockIcon}>
          <span className="text-sm font-medium tabular-nums">
            {hoursLabel(record.workedHours * 60)}
          </span>
        </RecordField>
        <RecordField type="static" label="Overtime" icon={ClockIcon}>
          <span className="text-sm tabular-nums">
            {hoursLabel(record.overtimeHours * 60)}
          </span>
        </RecordField>
        <RecordField type="static" label="Status" icon={ClockIcon}>
          <AttendanceStatusBadge status={record.status} />
        </RecordField>
      </RecordGroup>
      {record.editedAt && (
        <RecordGroup title="Latest correction">
          <p className="text-sm">
            {record.editedByName || 'Recorded editor'} ·{' '}
            {dateTimeLabel(record.editedAt)}
          </p>
          <p className="text-muted-foreground mt-2 whitespace-pre-wrap break-words text-sm">
            {record.editReason || 'No reason provided.'}
          </p>
        </RecordGroup>
      )}
      <p className="text-muted-foreground text-xs">
        Recorded {dateTimeLabel(record.createdAt)}. Updated{' '}
        {dateTimeLabel(record.updatedAt)}. All times are in India Standard Time
        (Asia/Kolkata).
      </p>
    </div>
  )
}
