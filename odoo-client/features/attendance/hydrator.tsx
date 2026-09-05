'use client'
import { useEffect } from 'react'
import { useAttendanceStore } from './store'
import { localDateTime } from './types'
import type { Attendance } from './types'
import { useSchedulesStore } from '@/features/working-schedules/store'
import type { WorkingSchedule } from '@/features/working-schedules/types'

export default function AttendanceHydrator({
  employeeIds,
}: {
  employeeIds: string[]
}) {
  useEffect(() => {
    const now = new Date()
    const schedules: WorkingSchedule[] = [
      {
        id: 'sch_standard',
        name: 'Standard work week',
        type: 'full-time',
        updatedAt: now.toISOString(),
        slots: [0, 1, 2, 3, 4].map((day) => ({
          day,
          start: '09:00',
          end: '18:00',
          breakMinutes: 60,
        })),
      },
      {
        id: 'sch_part_time',
        name: 'Morning part-time',
        type: 'part-time',
        updatedAt: now.toISOString(),
        slots: [0, 1, 2, 3, 4].map((day) => ({
          day,
          start: '09:00',
          end: '13:00',
          breakMinutes: 0,
        })),
      },
      {
        id: 'sch_support',
        name: 'Support shift',
        type: 'shift',
        updatedAt: now.toISOString(),
        slots: [1, 2, 3, 4, 5].map((day) => ({
          day,
          start: '12:00',
          end: '21:00',
          breakMinutes: 60,
        })),
      },
    ]
    useSchedulesStore
      .getState()
      .initialize(
        schedules,
        Object.fromEntries(
          employeeIds
            .slice(0, 6)
            .map((id, index) => [id, schedules[index % 3].id]),
        ),
      )
    const records: Attendance[] = []
    for (let offset = 1; offset <= 12; offset++) {
      const date = new Date(now)
      date.setDate(date.getDate() - offset)
      if (date.getDay() === 0 || date.getDay() === 6) continue
      employeeIds.slice(0, 6).forEach((employeeId, index) => {
        const start = new Date(date)
        start.setHours(index % 3 === 2 ? 12 : 9, index === 1 ? 15 : 0, 0, 0)
        const end = new Date(date)
        end.setHours(index % 3 === 2 ? 21 : index % 3 === 1 ? 13 : 18, 0, 0, 0)
        records.push({
          id: `att_demo_${offset}_${index}`,
          employeeId,
          checkIn: localDateTime(start),
          checkOut:
            offset === 1 && index === 0 ? undefined : localDateTime(end),
          breakMinutes: index % 3 === 1 ? 0 : 60,
          note: 'Illustrative attendance entry.',
          createdAt: start.toISOString(),
          corrections: [],
        })
      })
    }
    useAttendanceStore.getState().initialize(records)
  }, [employeeIds])
  return null
}
