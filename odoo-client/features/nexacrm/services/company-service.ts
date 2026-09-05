import 'server-only'

import type { Company } from '@/features/nexacrm/types/apps/company-types'

// Business-data APIs are not connected yet. Never manufacture records as a fallback.
export const getCompanies = async (): Promise<Company[]> => []

export const getCompanyById: (id: string) => Promise<Company | undefined> = async () => undefined
