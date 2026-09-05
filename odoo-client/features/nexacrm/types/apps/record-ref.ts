export const ENTITY_TYPES = ['company', 'person', 'opportunity'] as const

export type EntityType = (typeof ENTITY_TYPES)[number]

export const PARENT_ENTITY_TYPES = [...ENTITY_TYPES, 'task', 'note', 'workflow'] as const

export type ParentEntityType = (typeof PARENT_ENTITY_TYPES)[number]

export const ENTITY_TYPE_LABELS: Record<ParentEntityType, string> = {
  company: 'Company',
  person: 'Person',
  opportunity: 'Opportunity',
  task: 'Task',
  note: 'Note',
  workflow: 'Workflow'
}

/** A pointer to a record that may own sub-records. */
export type ParentRef = {
  entityType: ParentEntityType
  entityId: string
}

/** A pointer to a record a Task or Note may target. Narrower than `ParentRef` on purpose. */
export type RecordRef = {
  entityType: EntityType
  entityId: string
}

export const matchesRef = (ref: ParentRef, entityType: ParentEntityType, entityId: string): boolean =>
  ref.entityType === entityType && ref.entityId === entityId
