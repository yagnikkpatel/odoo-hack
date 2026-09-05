import type { Metadata } from 'next'
import { Suspense } from 'react'
import AttendanceView from '@/features/attendance'

export const metadata: Metadata = {
  title: 'Attendance',
  description: 'Employee attendance, worked hours and corrections.',
}
export default function AttendancePage() {
  return (
    <Suspense
      fallback={
        <p role="status" className="py-8 text-sm">
          Loading attendance…
        </p>
      }
    >
      <AttendanceView />
    </Suspense>
  )
}
