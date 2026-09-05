// Type Imports
import type { Company } from '@/features/nexacrm/types/apps/company-types'
import { companyDisplayName } from '@/features/nexacrm/types/apps/company-types'
import type { Note } from '@/features/nexacrm/types/apps/note-types'
import { noteDisplayName } from '@/features/nexacrm/types/apps/note-types'
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { opportunityDisplayName } from '@/features/nexacrm/types/apps/opportunity-types'
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'
import type { Task } from '@/features/nexacrm/types/apps/task-types'
import { taskDisplayName } from '@/features/nexacrm/types/apps/task-types'

export type ResolvedRecord =
  | { entityType: 'company'; company: Company }
  | { entityType: 'person'; person: Person }
  | { entityType: 'opportunity'; opportunity: Opportunity }
  | { entityType: 'task'; task: Task }
  | { entityType: 'note'; note: Note }

/** The record's display name, falling back to "Untitled" for a record created but not yet named. */
export const resolvedRecordLabel = (record: ResolvedRecord): string => {
  if (record.entityType === 'company') return companyDisplayName(record.company)
  if (record.entityType === 'person') return personDisplayName(record.person)
  if (record.entityType === 'task') return taskDisplayName(record.task)
  if (record.entityType === 'note') return noteDisplayName(record.note)

  return opportunityDisplayName(record.opportunity)
}

export const resolvedRecordHref = (record: ResolvedRecord): string | undefined => {
  if (record.entityType === 'company') return `/companies/${record.company.id}`
  if (record.entityType === 'person') return `/employees/${record.person.id}`
  if (record.entityType === 'task') return `/tasks/${record.task.id}`
  if (record.entityType === 'note') return `/notes/${record.note.id}`

  return `/opportunities/${record.opportunity.id}`
}
