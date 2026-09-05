import 'server-only'

// Type Imports
import type { Company } from '@/features/nexacrm/types/apps/company-types'

// Data Imports
import { db } from '@/features/nexacrm/fake-db/apps/companies'

const minutesAgoToIso = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const toCompany = ({ createdMinutesAgo, updatedMinutesAgo, ...company }: (typeof db)[number]): Company => ({
  ...company,
  createdAt: minutesAgoToIso(createdMinutesAgo),
  updatedAt: minutesAgoToIso(updatedMinutesAgo)
})

export const getCompanies = async (): Promise<Company[]> => {
  return db.map(toCompany)
}

export const getCompanyById = async (id: string): Promise<Company | undefined> => {
  const seed = db.find(company => company.id === id)

  return seed && toCompany(seed)
}
