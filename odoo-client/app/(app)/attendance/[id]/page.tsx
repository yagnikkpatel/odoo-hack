import type { Metadata } from 'next'
import AttendanceDetail from '@/features/attendance/detail'

export const metadata: Metadata = { title: 'Attendance details' }
export default async function AttendancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AttendanceDetail key={id} id={id} />
}
