// Type Imports
import type { EntityType, ParentEntityType, RecordRef } from '@/features/nexacrm/types/apps/record-ref'

export type RecordTarget = {
  id: string

  targetCompanyId?: string
  targetPersonId?: string
  targetOpportunityId?: string
}

/** A Task's join row. */
export type TaskTarget = RecordTarget & { taskId: string }

/** A Note's join row, identical but for the owning id. */
export type NoteTarget = RecordTarget & { noteId: string }

export const TARGET_COLUMNS = {
  company: 'targetCompanyId',
  person: 'targetPersonId',
  opportunity: 'targetOpportunityId'
} as const satisfies Record<EntityType, keyof Omit<RecordTarget, 'id'>>

/** Every (entityType, column) pair, for the readers that have to try all of them. */
const TARGET_ENTRIES = Object.entries(TARGET_COLUMNS) as [EntityType, (typeof TARGET_COLUMNS)[EntityType]][]

/** The record a join row points at, or `undefined` for a row whose target has been cleared. */
export const targetRef = (target: RecordTarget): RecordRef | undefined => {
  for (const [entityType, column] of TARGET_ENTRIES) {
    const entityId = target[column]

    if (entityId) return { entityType, entityId }
  }

  return undefined
}

/** The column half of a new join row - the inverse of `targetRef`. */
export const targetColumns = (ref: RecordRef): Omit<RecordTarget, 'id'> => ({
  [TARGET_COLUMNS[ref.entityType]]: ref.entityId
})

export const targetMatchesRef = (target: RecordTarget, entityType: ParentEntityType, entityId: string): boolean => {
  const column = TARGET_COLUMNS[entityType as EntityType]

  return column ? target[column] === entityId : false
}

/** Stable identity for a ref, for React keys and de-duplication. */
export const refKey = (ref: RecordRef): string => `${ref.entityType}:${ref.entityId}`

/** The refs of a set of join rows, in row order, with unresolvable and duplicate rows dropped. */
export const targetRefs = (targets: RecordTarget[]): RecordRef[] => {
  const seen = new Set<string>()

  return targets.flatMap(target => {
    const ref = targetRef(target)

    if (!ref || seen.has(refKey(ref))) return []
    seen.add(refKey(ref))

    return [ref]
  })
}
