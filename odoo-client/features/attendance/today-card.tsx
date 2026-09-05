'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import {
  ArrowRightIcon,
  Clock3Icon,
  LoaderCircleIcon,
  RefreshCwIcon,
  WifiOffIcon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card } from '@/features/nexacrm/components/ui/card'
import { useAttendanceStore } from './store'
import { companyDateTime, hoursLabel } from './types'
import type { Attendance } from './types'

function todayMessage(
  record: Attendance | null,
  loading: boolean,
  unavailable: boolean,
) {
  if (unavailable)
    return [
      'Attendance unavailable',
      'We couldn’t load your attendance. Try again in a moment.',
    ]
  if (loading) return ['Loading attendance', 'Getting your latest status…']
  if (record?.checkOut)
    return ['You’re checked out', 'Your attendance has been saved for today.']
  if (record?.checkIn)
    return ['You’re checked in', 'Check out when you finish for the day.']
  if (record)
    return [
      'No check-in recorded',
      'A record already exists for today. Contact HR to correct it.',
    ]
  return ['Ready to start your day?', 'Check in to record your arrival.']
}

function ClockButton({
  action,
  disabled,
}: {
  action: 'in' | 'out'
  disabled: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      name="action"
      value={action}
      disabled={disabled || pending}
      className="w-full sm:w-auto"
    >
      {pending ? (
        <LoaderCircleIcon className="size-4 animate-spin" />
      ) : (
        <ArrowRightIcon className="size-4" />
      )}
      {pending
        ? 'Saving…'
        : action === 'in'
          ? 'Check in'
          : 'Check out'}
    </Button>
  )
}

function TimeValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium tabular-nums">{value}</dd>
    </div>
  )
}

export default function TodayAttendance({ onRetry }: { onRetry?: () => void }) {
  const today = useAttendanceStore((state) => state.today)
  const todayLoading = useAttendanceStore((state) => state.todayLoading)
  const todayError = useAttendanceStore((state) => state.todayError)
  const loadToday = useAttendanceStore((state) => state.loadToday)
  const checkIn = useAttendanceStore((state) => state.checkIn)
  const checkOut = useAttendanceStore((state) => state.checkOut)
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [error, action] = useActionState(
    async (_previous: string | null, form: FormData) => {
      try {
        if (form.get('action') === 'out') await checkOut()
        else await checkIn()
        setAttempt((current) => current + 1)
        return null
      } catch (cause) {
        setAttempt((current) => current + 1)
        return cause instanceof Error
          ? cause.message
          : 'Attendance could not be saved.'
      }
    },
    null,
  )

  useEffect(() => {
    let active = true
    const refresh = () => {
      void loadToday()
        .catch(() => {})
        .finally(() => {
          if (active) setReady(true)
        })
    }
    refresh()
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 60000)
    return () => {
      active = false
      window.removeEventListener('focus', refresh)
      window.clearInterval(timer)
    }
  }, [loadToday, attempt])

  const open = Boolean(today?.checkIn && !today.checkOut)
  const unavailable = Boolean(todayError)
  const initialLoading = !ready && !unavailable
  const [title, description] = todayMessage(today, initialLoading, unavailable)
  const time = (value: string | null | undefined) =>
    value ? companyDateTime(new Date(value)).slice(11) : '—'

  return (
    <Card className="gap-0 overflow-hidden py-0" aria-busy={initialLoading}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-xl">
            {unavailable ? (
              <WifiOffIcon className="size-5" />
            ) : (
              <Clock3Icon className="size-5" />
            )}
          </span>
          <div>
            <p className="text-muted-foreground mb-1 text-xs">
              Today · India Standard Time
            </p>
            <h2
              className="text-base font-semibold"
              role={initialLoading ? 'status' : undefined}
            >
              {title}
            </h2>
            <p
              className="text-muted-foreground mt-1 text-sm"
              role={unavailable ? 'alert' : undefined}
            >
              {description}
            </p>
          </div>
        </div>
        {unavailable ? (
          <Button
            variant="outline"
            disabled={todayLoading}
            onClick={() => {
              setAttempt((current) => current + 1)
              onRetry?.()
            }}
          >
            <RefreshCwIcon
              className={todayLoading ? 'size-4 animate-spin' : 'size-4'}
            />
            {todayLoading ? 'Retrying…' : 'Try again'}
          </Button>
        ) : !initialLoading && (!today || open) ? (
          <form action={action}>
            <ClockButton action={open ? 'out' : 'in'} disabled={todayLoading} />
          </form>
        ) : null}
      </div>
      {!unavailable && !initialLoading && (today || error) && (
        <div className="border-t px-5 py-4">
          {today && (
            <dl className="grid grid-cols-3 gap-4">
              <TimeValue label="Check in" value={time(today.checkIn)} />
              <TimeValue label="Check out" value={time(today.checkOut)} />
              <TimeValue
                label="Worked"
                value={
                  open ? 'In progress' : hoursLabel(today.workedHours * 60)
                }
              />
            </dl>
          )}
          {error && (
            <p role="alert" className="text-destructive mt-3 text-sm">
              {error}
            </p>
          )}
        </div>
      )}
    </Card>
  )
}
