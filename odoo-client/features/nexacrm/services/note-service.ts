import 'server-only'

import type { Note } from '@/features/nexacrm/types/apps/note-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'
import type { NoteTarget } from '@/features/nexacrm/types/apps/record-target'

export type NotesData = { notes: Note[]; noteTargets: NoteTarget[] }

// Business-data APIs are not connected yet. Never manufacture records as a fallback.
export const getNotesData = async (): Promise<NotesData> => ({ notes: [], noteTargets: [] })

export const getNotesForEntity: (entityType: EntityType, entityId: string) => Promise<Note[]> = async () => []

export const getNoteById: (id: string) => Promise<Note | undefined> = async () => undefined
