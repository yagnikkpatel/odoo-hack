import { format } from 'date-fns'
import { parseDateValue } from '@/features/nexacrm/lib/date-time'
import type { TimeOffRequest } from '../model'

export function leaveDateLabel(value: string) {
  const date = parseDateValue(value)
  return date ? format(date, 'dd MMM yyyy') : 'Not set'
}

export function requestPeriod(
  record: Pick<TimeOffRequest, 'startDate' | 'endDate' | 'startTime' | 'endTime' | 'unit'>
) {
  if (record.unit === 'hours') return `${leaveDateLabel(record.startDate)} · ${record.startTime}–${record.endTime}`
  return record.startDate === record.endDate
    ? leaveDateLabel(record.startDate)
    : `${leaveDateLabel(record.startDate)} – ${leaveDateLabel(record.endDate)}`
}

export function decisionDateLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : format(date, 'dd MMM yyyy, HH:mm')
}
