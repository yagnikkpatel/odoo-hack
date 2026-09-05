export const SEARCHABLE_OPTION_THRESHOLD = 8

const normalize = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export function filterOptions<T>(items: readonly T[], query: string, label: (item: T) => string): T[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  return items.filter(item => terms.every(term => normalize(label(item)).includes(term)))
}
