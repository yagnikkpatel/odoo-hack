import type { Metadata } from 'next'
import RequestDetail from '@/features/time-off/requests/detail'

export const metadata: Metadata = { title: 'Time off requests details' }
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RequestDetail key={id} requestId={id} />
}
