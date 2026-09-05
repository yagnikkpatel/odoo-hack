import type { Metadata } from 'next'
import { Suspense } from 'react'
import SchedulesView from '@/features/working-schedules'

export const metadata: Metadata = {
  title: 'Working schedules',
  description: 'Weekly patterns, hours and employee assignments.',
}
export default function SchedulesPage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="py-8 text-sm">
          Loading working schedules…
        </p>
      }
    >
      <SchedulesView />
    </Suspense>
  )
}
