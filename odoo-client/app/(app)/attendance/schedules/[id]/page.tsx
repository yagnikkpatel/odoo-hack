import type { Metadata } from 'next'
import ScheduleDetail from '@/features/working-schedules/detail'

export const metadata: Metadata = { title: 'Working schedule details' }
export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <ScheduleDetail key={id} id={id} />
}
