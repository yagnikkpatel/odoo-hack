import { redirect } from 'next/navigation'

export default async function OpportunityAlias({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, values] = await Promise.all([params, searchParams])
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item))
    else if (value !== undefined) query.set(key, value)
  }
  redirect(`/kanban/${encodeURIComponent(id)}${query.size ? `?${query}` : ''}`)
}
