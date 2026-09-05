// Third-party Imports
import { format } from 'date-fns'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { formatPersonName, personDisplayName } from '@/features/nexacrm/types/apps/person-types'

// Util Imports
import { downloadCsv } from '@/features/nexacrm/utils/csv'
import { formatDate } from '@/features/nexacrm/utils/format'

export const downloadPeopleCsv = (
  people: Person[],
  resolve: { companyName: (companyId?: string) => string; ownerName: (accountOwnerId?: string) => string },
  filename = 'people.csv'
): void =>
  downloadCsv(
    filename,
    people.map(person => ({
      Name: formatPersonName(person),
      Email: person.email,
      Phone: person.phone ?? '',
      'Job title': person.jobTitle ?? '',
      Company: resolve.companyName(person.companyId),
      'Primary contact': person.isPrimary ? 'Yes' : 'No',
      City: person.city ?? '',
      Country: person.country ?? '',
      LinkedIn: person.linkedinUrl ?? '',
      'Account owner': resolve.ownerName(person.accountOwnerId),
      Created: formatDate(person.createdAt)
    }))
  )

export const downloadPersonCsv = (person: Person, companyName?: string): void => {
  const slug = personDisplayName(person)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  downloadCsv(`${slug || 'person'}.csv`, [
    {
      'First name': person.firstName,
      'Last name': person.lastName,
      Email: person.email,
      Phone: person.phone ?? '',
      'Job title': person.jobTitle ?? '',
      Company: companyName ?? '',
      'Primary contact': person.isPrimary ? 'Yes' : 'No',
      City: person.city ?? '',
      Country: person.country ?? '',
      LinkedIn: person.linkedinUrl ?? '',
      X: person.xUrl ?? '',
      Created: format(new Date(person.createdAt), 'MMM d, yyyy'),
      Updated: format(new Date(person.updatedAt), 'MMM d, yyyy')
    }
  ])
}
