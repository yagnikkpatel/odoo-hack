import type { Metadata } from 'next'
import TypeDetail from '@/features/time-off/types/detail'

export const metadata: Metadata = { title: 'Time off types details' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TypeDetail key={id} typeId={id} />
}
