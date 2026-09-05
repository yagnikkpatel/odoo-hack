import 'server-only'

// Type Imports
import type { Note } from '@/features/nexacrm/types/apps/note-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'
import type { NoteTarget } from '@/features/nexacrm/types/apps/record-target'
import { targetMatchesRef } from '@/features/nexacrm/types/apps/record-target'

// Data Imports
import { db, targetsDb } from '@/features/nexacrm/fake-db/apps/notes'

const minutesAgoToIso = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const toNote = ({ createdMinutesAgo, ...note }: (typeof db)[number]): Note => ({
  ...note,
  createdAt: minutesAgoToIso(createdMinutesAgo),
  updatedAt: minutesAgoToIso(createdMinutesAgo)
})

export type NotesData = { notes: Note[]; noteTargets: NoteTarget[] }

export const getNotesData = async (): Promise<NotesData> => {
  return { notes: db.map(toNote), noteTargets: targetsDb }
}

/** The notes linked to one record, resolved THROUGH the join table. */
export const getNotesForEntity = async (entityType: EntityType, entityId: string): Promise<Note[]> => {
  const noteIds = new Set(
    targetsDb.filter(target => targetMatchesRef(target, entityType, entityId)).map(target => target.noteId)
  )

  return db.filter(note => noteIds.has(note.id)).map(toNote)
}

/** One note by id - the record route reads it on the server for the page title. */
export const getNoteById = async (id: string): Promise<Note | undefined> => {
  const seed = db.find(note => note.id === id)

  return seed && toNote(seed)
}
