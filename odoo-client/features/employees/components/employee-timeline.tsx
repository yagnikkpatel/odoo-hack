'use client'

import { useEffect, useState } from 'react'
import {
  ClockIcon,
  LogInIcon,
  LogOutIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import { RecordHeading } from '@/features/nexacrm/components/record/record-section'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useAttendancePermissions } from '@/features/attendance/permissions'
import { listAttendances } from '@/features/attendance/service'
import { ATTENDANCE_TIMEZONE } from '@/features/attendance/types'
import type { Attendance } from '@/features/attendance/types'
import AttendanceStatusBadge from '@/features/attendance/status-badge'
import { useContractPermissions } from '@/features/contracts/permissions'
import { getEmployeeContractAuditLog } from '@/features/contracts/service'
import {
  CONTRACT_HISTORY_FIELD_LABELS,
  formatContractHistoryValue,
  formatContractTimestamp,
} from '@/features/contracts/types'
import type { ContractHistoryEntry } from '@/features/contracts/types'

function dayLabel(dateKey: string) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateKey + 'T12:00:00'))
}

function timeLabel(value: string | null) {
  if (!value) return null
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ATTENDANCE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function dateKeyOf(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ATTENDANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value))
}

function PunchRow({
  icon: Icon,
  label,
  time,
  isLast,
}: {
  icon: typeof LogInIcon
  label: string
  time: string | null
  isLast: boolean
}) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="bg-background text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border">
          <Icon className="size-3" />
        </span>
        {!isLast ? <span className="bg-border my-1 w-px flex-1" /> : null}
      </div>
      <div className={'min-w-0 flex-1 ' + (isLast ? 'pb-1' : 'pb-4')}>
        <p className="text-sm">
          <span className="font-medium">{label}</span>{' '}
          <span className="text-muted-foreground">{time ?? 'not recorded'}</span>
        </p>
      </div>
    </li>
  )
}

const CONTRACT_ACTION_LABEL: Record<ContractHistoryEntry['action'], string> = {
  created: 'Contract created',
  updated: 'Contract updated',
  deleted: 'Contract deleted',
}

const CONTRACT_ACTION_ICON: Record<
  ContractHistoryEntry['action'],
  typeof PlusIcon
> = {
  created: PlusIcon,
  updated: PencilIcon,
  deleted: Trash2Icon,
}

function ContractCheckpoint({ entry }: { entry: ContractHistoryEntry }) {
  const Icon = CONTRACT_ACTION_ICON[entry.action]
  const fields = Object.entries(entry.changes)
  return (
    <section aria-label={`Contract update ${entry.id}`}>
      <div className="flex items-center gap-3 pb-3">
        <h3 className="text-muted-foreground shrink-0 text-xs">
          {dayLabel(dateKeyOf(entry.createdAt))}
        </h3>
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs">
          <Icon className="size-3" />
          Contract
        </span>
      </div>
      <ul>
        <li className="flex gap-3">
          <div className="flex flex-col items-center">
            <span className="bg-background text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full border">
              <Icon className="size-3" />
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1 pb-1">
            <p className="text-sm">
              <span className="font-medium">
                {CONTRACT_ACTION_LABEL[entry.action]}
              </span>{' '}
              <span className="text-muted-foreground">
                {formatContractTimestamp(entry.createdAt)}
              </span>
            </p>
            <p className="text-muted-foreground text-xs">
              By {entry.changedByName ?? 'Unknown user'}
            </p>
            {fields.length > 0 && (
              <ul className="space-y-1 pt-1">
                {fields.map(([field, change]) => (
                  <li key={field} className="text-sm">
                    <span className="text-muted-foreground">
                      {CONTRACT_HISTORY_FIELD_LABELS[field] ?? field}:
                    </span>{' '}
                    <span className="line-through opacity-60">
                      {formatContractHistoryValue(field, change.old)}
                    </span>{' '}
                    <span aria-hidden>→</span>{' '}
                    <span>{formatContractHistoryValue(field, change.new)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </li>
      </ul>
    </section>
  )
}

type TimelineBlock =
  | { kind: 'attendance'; date: string; record: Attendance }
  | { kind: 'contract'; date: string; entry: ContractHistoryEntry }

export default function EmployeeTimeline({ employeeId }: { employeeId: string }) {
  const { user } = useCurrentUser()
  const { canReadAny, canReadOwn } = useAttendancePermissions()
  const { canRead: canReadContracts } = useContractPermissions()
  const allowed = canReadAny || (canReadOwn && user.id === employeeId)
  const [records, setRecords] = useState<Attendance[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contractHistory, setContractHistory] = useState<
    ContractHistoryEntry[] | null
  >(null)
  const [contractHistoryError, setContractHistoryError] = useState<
    string | null
  >(null)

  useEffect(() => {
    if (!canReadContracts) return
    const controller = new AbortController()
    void getEmployeeContractAuditLog(employeeId)
      .then((entries) => {
        if (controller.signal.aborted) return
        setContractHistory(entries)
        setContractHistoryError(null)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setContractHistoryError(
          cause instanceof Error
            ? cause.message
            : 'Contract history could not be loaded.',
        )
      })
    return () => controller.abort()
  }, [canReadContracts, employeeId])

  useEffect(() => {
    if (!allowed) return
    const controller = new AbortController()
    void listAttendances(
      {
        scope: canReadAny ? 'all' : 'own',
        employeeId: canReadAny ? employeeId : undefined,
        limit: 20,
        offset: 0,
      },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return
        setRecords(result.attendances)
        setError(null)
      })
      .catch((cause) => {
        if (controller.signal.aborted) return
        setError(
          cause instanceof Error ? cause.message : 'Timeline could not be loaded.',
        )
      })
    return () => controller.abort()
  }, [allowed, canReadAny, employeeId])

  const attendanceReady = !allowed || records !== null
  const contractReady = !canReadContracts || contractHistory !== null
  const ready = attendanceReady && contractReady

  const blocks: TimelineBlock[] = []
  if (allowed && records) {
    for (const record of records) {
      blocks.push({ kind: 'attendance', date: record.attendanceDate, record })
    }
  }
  if (canReadContracts && contractHistory) {
    for (const entry of contractHistory) {
      blocks.push({ kind: 'contract', date: dateKeyOf(entry.createdAt), entry })
    }
  }
  blocks.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  if (!allowed && !canReadContracts) {
    return (
      <div className="space-y-4">
        <RecordHeading title="Timeline" />
        <p className="text-muted-foreground text-sm">
          You can only view your own timeline.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <RecordHeading title="Timeline" count={ready ? blocks.length : undefined} />
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {contractHistoryError && (
        <p role="alert" className="text-destructive text-sm">
          {contractHistoryError}
        </p>
      )}
      {!ready ? (
        <p role="status" className="text-muted-foreground py-4 text-sm">
          Loading timeline…
        </p>
      ) : blocks.length === 0 ? (
        <DataTableEmptyState
          icon={ClockIcon}
          title="Nothing to show yet"
          description="Check-ins, check-outs, and contract updates for this employee will appear here, newest first."
        />
      ) : (
        <div className="space-y-5">
          {blocks.map((block) =>
            block.kind === 'attendance' ? (
              <section key={block.record.id} aria-label={block.record.attendanceDate}>
                <div className="flex items-center gap-3 pb-3">
                  <h3 className="text-muted-foreground shrink-0 text-xs">
                    {dayLabel(block.record.attendanceDate)}
                  </h3>
                  <span className="bg-border h-px flex-1" />
                  <AttendanceStatusBadge status={block.record.status} />
                </div>
                <ul>
                  <PunchRow
                    icon={LogInIcon}
                    label="Checked in"
                    time={timeLabel(block.record.checkIn)}
                    isLast={false}
                  />
                  <PunchRow
                    icon={LogOutIcon}
                    label="Checked out"
                    time={timeLabel(block.record.checkOut)}
                    isLast
                  />
                </ul>
              </section>
            ) : (
              <ContractCheckpoint key={block.entry.id} entry={block.entry} />
            ),
          )}
        </div>
      )}
      {allowed && (
        <p className="text-muted-foreground text-xs">
          Times shown in India Standard Time (Asia/Kolkata).
        </p>
      )}
    </div>
  )
}
