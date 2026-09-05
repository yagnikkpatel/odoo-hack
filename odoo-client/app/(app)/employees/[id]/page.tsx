import PersonDetailView from '@/features/nexacrm/views/apps/people/person-detail'

export default async function EmployeePage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ section?: string }>
}) {
  const [{ id }, { section }] = await Promise.all([params, searchParams])
  // The source supports client-created demo IDs, so resolve records from the hydrated store.
  return <PersonDetailView personId={id} initialSection={section} />
}
