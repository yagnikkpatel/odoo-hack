export type Person = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  jobTitle?: string

  /** Portrait for the Avatar; falls back to the person's initials. */
  avatar?: string

  /** Canonical reference - the Company they work at. Undefined = none. */
  companyId?: string

  /** Marks the main point of contact at that company. */
  isPrimary?: boolean
  city?: string
  country?: string
  linkedinUrl?: string
  xUrl?: string

  /** Canonical reference - the owning User. Undefined = unassigned. */
  accountOwnerId?: string

  /** Audit actors - canonical User references; undefined = the system did it (import/enrichment). */
  createdById?: string
  updatedById?: string
  createdAt: string
  updatedAt: string
}

/** Input shape used by create flows and service mutations. */
export type PersonInput = Omit<Person, 'id' | 'createdAt' | 'updatedAt'>

/** "Ada" + "Lovelace" → "Ada Lovelace". */
export const formatPersonName = (person: Pick<Person, 'firstName' | 'lastName'>): string =>
  `${person.firstName} ${person.lastName}`.trim()

/** What a person with no name yet is called, so a blank record still reads as something. */
export const personDisplayName = (person: Pick<Person, 'firstName' | 'lastName'>): string =>
  formatPersonName(person) || 'Untitled'

export const splitPersonName = (raw: string): Pick<Person, 'firstName' | 'lastName'> => {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  const firstSpace = trimmed.indexOf(' ')

  if (firstSpace === -1) return { firstName: trimmed, lastName: '' }

  return { firstName: trimmed.slice(0, firstSpace), lastName: trimmed.slice(firstSpace + 1) }
}

/** A blank person for the "+ New person" flow - created first, named in the panel. */
export const buildBlankPersonInput = (): PersonInput => ({
  firstName: '',
  lastName: '',
  email: ''
})

export const PERSON_FIELD_LABELS: Partial<Record<keyof Person, string>> = {
  firstName: 'First name',
  lastName: 'Last name',
  email: 'Email',
  phone: 'Phone',
  jobTitle: 'Job title',
  avatar: 'Avatar',
  companyId: 'Company',
  isPrimary: 'Main contact',
  city: 'City',
  country: 'Country',
  linkedinUrl: 'LinkedIn',
  xUrl: 'X',
  accountOwnerId: 'Account owner'
}
