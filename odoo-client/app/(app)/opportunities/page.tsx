import { redirect } from 'next/navigation'

// Keep the template's original cross-links working without changing its JSX.
export default async function OpportunitiesAlias({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item))
    else if (value !== undefined) query.set(key, value)
  }
  redirect(`/kanban${query.size ? `?${query}` : ''}`)
}
