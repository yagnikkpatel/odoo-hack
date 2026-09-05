import 'server-only'

import type { Person } from '@/features/nexacrm/types/apps/person-types'

// Business-data APIs are not connected yet. Never manufacture records as a fallback.
export const getPeople = async (): Promise<Person[]> => []

export const getPersonById: (id: string) => Promise<Person | undefined> = async () => undefined
