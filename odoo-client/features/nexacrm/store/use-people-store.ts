// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { ActivityChange } from '@/features/nexacrm/types/apps/activity-types'
import type { Person, PersonInput } from '@/features/nexacrm/types/apps/person-types'
import { PERSON_FIELD_LABELS, personDisplayName } from '@/features/nexacrm/types/apps/person-types'

// Store Imports
import { useActivitiesStore } from '@/features/nexacrm/store/use-activities-store'
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { getActorId } from '@/features/nexacrm/store/use-current-actor-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

const buildPerson = (input: PersonInput): Person => {
  const now = new Date().toISOString()
  const actorId = getActorId()

  return {
    createdById: actorId,
    updatedById: actorId,
    ...input,
    id: `per_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now
  }
}

type PeopleData = {
  people: Person[]
  hasHydrated: boolean
}

type PeopleActions = {
  initialize: (people: Person[]) => void
  addPerson: (input: PersonInput) => string

  addPeople: (inputs: PersonInput[]) => void
  updatePerson: (id: string, input: Partial<PersonInput>) => void
  deletePerson: (id: string) => void
  deletePeople: (ids: string[]) => void
}

export type PeopleStore = PeopleData & PeopleActions

const formatChangeValue = (field: keyof Person, value: Person[keyof Person]): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined

  if (field === 'companyId') return useCompaniesStore.getState().companies.find(item => item.id === value)?.name
  if (field === 'accountOwnerId') return useUsersStore.getState().users.find(user => user.id === value)?.name
  if (field === 'isPrimary') return value ? 'Yes' : undefined

  return String(value)
}

const logFieldChanges = (before: Person, input: Partial<PersonInput>) => {
  const changes: ActivityChange[] = []

  for (const key of Object.keys(input) as (keyof PersonInput)[]) {
    const label = PERSON_FIELD_LABELS[key]

    if (!label || before[key] === input[key]) continue

    changes.push({ label, value: formatChangeValue(key, input[key]) })
  }

  if (changes.length === 0) return

  useActivitiesStore.getState().addActivity({
    entityType: 'person',
    entityId: before.id,
    type: 'status',
    actorId: getActorId(),
    verb: `updated ${changes.length} ${changes.length === 1 ? 'field' : 'fields'} on`,
    subject: personDisplayName({ ...before, ...input }),
    changes
  })
}

export const usePeopleStore = create<PeopleStore>()((set, get) => ({
  people: [],
  hasHydrated: false,

  initialize: people => set({ people, hasHydrated: true }),

  addPerson: input => {
    const person = buildPerson(input)

    set(state => ({ people: [person, ...state.people] }))

    return person.id
  },

  addPeople: inputs => set(state => ({ people: [...inputs.map(buildPerson), ...state.people] })),

  updatePerson: (id, input) => {
    const before = get().people.find(person => person.id === id)

    set(state => {
      const current = state.people.find(person => person.id === id)

      if (!current) return state

      const now = new Date().toISOString()
      const next = { ...current, ...input, updatedById: getActorId(), updatedAt: now }

      if (!next.companyId) next.isPrimary = undefined

      const demoteAtCompanyId = next.isPrimary ? next.companyId : undefined

      return {
        people: state.people.map(person => {
          if (person.id === id) return next

          if (demoteAtCompanyId && person.isPrimary && person.companyId === demoteAtCompanyId) {
            return { ...person, isPrimary: undefined, updatedAt: now }
          }

          return person
        })
      }
    })

    if (before) logFieldChanges(before, input)
  },

  deletePerson: id => set(state => ({ people: state.people.filter(person => person.id !== id) })),

  deletePeople: ids => set(state => ({ people: state.people.filter(person => !ids.includes(person.id)) }))
}))

export const usePerson = (id?: string): Person | undefined =>
  usePeopleStore(state => (id ? state.people.find(person => person.id === id) : undefined))

export const useCompanyPeople = (companyId?: string): Person[] => {
  const people = usePeopleStore(state => state.people)

  return useMemo(() => {
    if (!companyId) return []

    return people
      .filter(person => person.companyId === companyId)
      .sort((a, b) => Number(b.isPrimary ?? false) - Number(a.isPrimary ?? false))
  }, [people, companyId])
}

export const usePersonNavigation = (id: string) => {
  const people = usePeopleStore(state => state.people)

  return useMemo(() => {
    const index = people.findIndex(person => person.id === id)

    return {
      index,
      total: people.length,
      previousId: index > 0 ? people[index - 1].id : undefined,
      nextId: index >= 0 && index < people.length - 1 ? people[index + 1].id : undefined
    }
  }, [people, id])
}
