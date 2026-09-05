// Type Imports
import type { PersonInput } from '@/features/nexacrm/types/apps/person-types'
import { splitPersonName } from '@/features/nexacrm/types/apps/person-types'
import type { ImportField, ParsedRow } from '@/features/nexacrm/components/data-table/import-dialog'

export const PERSON_IMPORT_FIELDS: ImportField[] = [
  { key: 'name', label: 'Name', aliases: ['full name', 'contact', 'person'] },
  { key: 'firstName', label: 'First name', aliases: ['given name'] },
  { key: 'lastName', label: 'Last name', aliases: ['surname', 'family name'] },
  { key: 'email', label: 'Email', aliases: ['email address', 'e-mail'] },
  { key: 'phone', label: 'Phone', aliases: ['phone number', 'mobile', 'telephone'] },
  { key: 'jobTitle', label: 'Job title', aliases: ['title', 'role', 'position'] },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'linkedinUrl', label: 'LinkedIn', aliases: ['linkedin url'] },
  { key: 'xUrl', label: 'X', aliases: ['twitter', 'x url'] },

  { key: 'companyId', label: 'Company', aliases: ['company name', 'organisation', 'organization'] },
  { key: 'accountOwnerId', label: 'Account owner', aliases: ['owner', 'account manager'] },

  { key: 'isPrimary', label: 'Primary contact', aliases: ['primary', 'main contact'] }
]

const TRUE_VALUES = ['yes', 'y', 'true', '1', 'primary']

const orUndefined = (value: string) => value || undefined

export type PersonImportResolvers = {
  companyId: (name: string) => string | undefined
  accountOwnerId: (name: string) => string | undefined
}

export const createPersonRowParser =
  (resolve: PersonImportResolvers) =>
  (values: Record<string, string>): ParsedRow<PersonInput> => {
    // Preserve the source CSV rules without introducing a schema/state library.
    const parsed = Object.fromEntries(
      PERSON_IMPORT_FIELDS.map(field => [field.key, (values[field.key] ?? '').trim()])
    ) as Record<string, string>
    const errors: string[] = []
    if (!parsed.name && !parsed.firstName && !parsed.lastName) errors.push('A name is required')
    if (parsed.email && !parsed.email.includes('@')) errors.push('Email is not a valid address')
    if (errors.length) return { ok: false, error: errors.join('; ') }

    const { firstName, lastName } =
      parsed.firstName || parsed.lastName
        ? { firstName: parsed.firstName, lastName: parsed.lastName }
        : splitPersonName(parsed.name)

    return {
      ok: true,
      input: {
        firstName,
        lastName,
        email: parsed.email,
        phone: orUndefined(parsed.phone),
        jobTitle: orUndefined(parsed.jobTitle),
        city: orUndefined(parsed.city),
        country: orUndefined(parsed.country),
        linkedinUrl: orUndefined(parsed.linkedinUrl),
        xUrl: orUndefined(parsed.xUrl),
        isPrimary: TRUE_VALUES.includes(parsed.isPrimary.toLowerCase()),
        companyId: resolve.companyId(parsed.companyId),
        accountOwnerId: resolve.accountOwnerId(parsed.accountOwnerId)
      }
    }
  }
