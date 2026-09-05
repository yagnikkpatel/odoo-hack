'use client'

// React Imports
import { useMemo } from 'react'

// Type Imports
import type { ActivityChange, ActivityType } from '@/features/nexacrm/types/apps/activity-types'
import type { ParentEntityType } from '@/features/nexacrm/types/apps/record-ref'

// Store Imports
import { useEntityActivities } from '@/features/nexacrm/store/use-activities-store'
import { useEntityNotes } from '@/features/nexacrm/store/use-notes-store'

export type FeedEntry = {
  id: string
  type: ActivityType
  actorId?: string
  verb: string
  subject: string
  body?: string
  at: string

  /** Set when the entry IS a note - the timeline opens it rather than just describing it. */
  noteId?: string

  /** The fields an edit moved, when the entry is a record update. */
  changes?: ActivityChange[]
}

export const useRecordFeed = (entityType: ParentEntityType, entityId: string): FeedEntry[] => {
  const activities = useEntityActivities(entityType, entityId)
  const notes = useEntityNotes(entityType, entityId)

  return useMemo(() => {
    const fromActivities: FeedEntry[] = activities.map(activity => ({
      id: activity.id,
      type: activity.type,
      actorId: activity.actorId,
      verb: activity.verb,
      subject: activity.subject,
      body: activity.body,
      at: activity.occurredAt,
      changes: activity.changes
    }))

    const fromNotes: FeedEntry[] = notes.map(note => ({
      id: `feed_${note.id}`,
      type: 'note',
      actorId: note.createdById,
      verb: 'added a note',
      subject: note.title || 'Untitled',
      body: note.body,
      at: note.createdAt,
      noteId: note.id
    }))

    return [...fromActivities, ...fromNotes].sort((a, b) => b.at.localeCompare(a.at))
  }, [activities, notes])
}
