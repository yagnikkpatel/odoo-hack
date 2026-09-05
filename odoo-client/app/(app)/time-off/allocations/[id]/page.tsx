import type { Metadata } from 'next'
import AllocationDetail from '@/features/time-off/allocations/detail'

export const metadata: Metadata = { title: 'Allocations details' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <AllocationDetail key={id} allocationId={id} />
}
