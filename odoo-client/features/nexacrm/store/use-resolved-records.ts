'use client'

// React Imports
import { useCallback, useMemo } from 'react'

// Type Imports
import type { ParentRef } from '@/features/nexacrm/types/apps/record-ref'
import type { ResolvedRecord } from '@/features/nexacrm/types/apps/resolved-record'

// Store Imports
import { useCompaniesStore } from '@/features/nexacrm/store/use-companies-store'
import { useNotesStore } from '@/features/nexacrm/store/use-notes-store'
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'
import { useTasksStore } from '@/features/nexacrm/store/use-tasks-store'

export const useResolveRecord = (): ((ref: ParentRef) => ResolvedRecord | undefined) => {
  const companies = useCompaniesStore(state => state.companies)
  const people = usePeopleStore(state => state.people)
  const opportunities = useOpportunitiesStore(state => state.opportunities)
  const tasks = useTasksStore(state => state.tasks)
  const notes = useNotesStore(state => state.notes)

  return useCallback(
    (ref: ParentRef): ResolvedRecord | undefined => {
      if (ref.entityType === 'company') {
        const company = companies.find(item => item.id === ref.entityId)

        return company && { entityType: 'company', company }
      }

      if (ref.entityType === 'person') {
        const person = people.find(item => item.id === ref.entityId)

        return person && { entityType: 'person', person }
      }

      if (ref.entityType === 'task') {
        const task = tasks.find(item => item.id === ref.entityId)

        return task && { entityType: 'task', task }
      }

      if (ref.entityType === 'note') {
        const note = notes.find(item => item.id === ref.entityId)

        return note && { entityType: 'note', note }
      }

      if (ref.entityType === 'opportunity') {
        const opportunity = opportunities.find(item => item.id === ref.entityId)

        return opportunity && { entityType: 'opportunity', opportunity }
      }

      return undefined
    },
    [companies, people, opportunities, tasks, notes]
  )
}

/** The resolvable records for a list of refs, in ref order. Unresolvable refs drop out. */
export const useResolvedRecords = (refs: ParentRef[]): ResolvedRecord[] => {
  const resolve = useResolveRecord()

  return useMemo(() => refs.flatMap(ref => resolve(ref) ?? []), [refs, resolve])
}
