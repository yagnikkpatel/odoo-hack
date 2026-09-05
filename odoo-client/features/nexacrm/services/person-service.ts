import 'server-only'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'

// Data Imports
import { db } from '@/features/nexacrm/fake-db/apps/people'

const minutesAgoToIso = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const toPerson = ({ createdMinutesAgo, updatedMinutesAgo, ...person }: (typeof db)[number]): Person => ({
  ...person,
  createdAt: minutesAgoToIso(createdMinutesAgo),
  updatedAt: minutesAgoToIso(updatedMinutesAgo)
})

export const getPeople = async (): Promise<Person[]> => {
  return db.map(toPerson)
}

export const getPersonById = async (id: string): Promise<Person | undefined> => {
  const seed = db.find(person => person.id === id)

  return seed && toPerson(seed)
}
