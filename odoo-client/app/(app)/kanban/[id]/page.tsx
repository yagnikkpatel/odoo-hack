import type { Metadata } from 'next'
import OpportunityDetailView from '@/features/nexacrm/views/apps/opportunities/opportunity-detail'

export const metadata: Metadata = { title: 'Kanban record' }

export default async function KanbanRecordPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ section?: string }>
}) {
  const [{ id }, { section }] = await Promise.all([params, searchParams])
  return <OpportunityDetailView opportunityId={id} initialSection={section} />
}
