// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { ActivityChange } from '@/features/nexacrm/types/apps/activity-types'
import type { Note, NoteInput } from '@/features/nexacrm/types/apps/note-types'
import { NOTE_FIELD_LABELS, noteDisplayName } from '@/features/nexacrm/types/apps/note-types'
import type { ParentEntityType, RecordRef } from '@/features/nexacrm/types/apps/record-ref'
import type { NoteTarget } from '@/features/nexacrm/types/apps/record-target'
import { refKey, targetColumns, targetMatchesRef, targetRefs } from '@/features/nexacrm/types/apps/record-target'

// Store Imports
import { useActivitiesStore } from '@/features/nexacrm/store/use-activities-store'
import { getActorId } from '@/features/nexacrm/store/use-current-actor-store'

const buildNote = (input: NoteInput): Note => {
  const now = new Date().toISOString()

  return {
    createdById: getActorId(),
    ...input,
    id: `note_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now
  }
}

/** Join rows for one note from a set of refs - de-duplicated, since a link twice is still one link. */
const buildTargets = (noteId: string, refs: RecordRef[]): NoteTarget[] => {
  const seen = new Set<string>()

  return refs.flatMap(ref => {
    if (seen.has(refKey(ref))) return []
    seen.add(refKey(ref))

    return [{ id: `ntgt_${crypto.randomUUID().slice(0, 8)}`, noteId, ...targetColumns(ref) }]
  })
}

const logFieldChanges = (before: Note, input: Partial<Note>) => {
  const changes: ActivityChange[] = []

  for (const key of Object.keys(input) as (keyof Note)[]) {
    const label = NOTE_FIELD_LABELS[key]

    if (!label || before[key] === input[key]) continue

    changes.push({ label, value: input[key] ? String(input[key]) : undefined })
  }

  if (changes.length === 0) return

  const title = 'title' in input && input.title ? input.title : noteDisplayName(before)

  useActivitiesStore.getState().addActivity({
    entityType: 'note',
    entityId: before.id,
    type: 'status',
    actorId: getActorId(),
    verb: `updated ${changes.length} ${changes.length === 1 ? 'field' : 'fields'} on`,
    subject: title,
    changes
  })
}

type NotesData = {
  notes: Note[]

  /** The join table. One row = one (note → record) link, exactly one target column set. */
  noteTargets: NoteTarget[]
  hasHydrated: boolean
}

type NotesActions = {
  initialize: (data: { notes: Note[]; noteTargets: NoteTarget[] }) => void

  /** Creates the note AND its join rows together, so a new note is never briefly unlinked. */
  addNote: (input: NoteInput, refs?: RecordRef[]) => string
  updateNote: (id: string, input: Partial<Omit<Note, 'id' | 'createdAt'>>) => void

  /** Replaces a note's whole target set - what the Relations picker commits. */
  setNoteTargets: (noteId: string, refs: RecordRef[]) => void
  deleteNote: (id: string) => void
  deleteNotes: (ids: string[]) => void
}

export type NotesStore = NotesData & NotesActions

export const useNotesStore = create<NotesStore>()((set, get) => ({
  notes: [],
  noteTargets: [],
  hasHydrated: false,

  initialize: ({ notes, noteTargets }) => set({ notes, noteTargets, hasHydrated: true }),

  addNote: (input, refs = []) => {
    const note = buildNote(input)

    set(state => ({
      notes: [note, ...state.notes],
      noteTargets: [...state.noteTargets, ...buildTargets(note.id, refs)]
    }))

    return note.id
  },

  updateNote: (id, input) => {
    const before = get().notes.find(note => note.id === id)

    set(state => ({
      notes: state.notes.map(note =>
        note.id === id ? { ...note, ...input, updatedById: getActorId(), updatedAt: new Date().toISOString() } : note
      )
    }))

    if (before) logFieldChanges(before, input)
  },

  setNoteTargets: (noteId, refs) =>
    set(state => ({
      noteTargets: [...state.noteTargets.filter(target => target.noteId !== noteId), ...buildTargets(noteId, refs)],
      notes: state.notes.map(note => (note.id === noteId ? { ...note, updatedAt: new Date().toISOString() } : note))
    })),

  deleteNote: id =>
    set(state => ({
      notes: state.notes.filter(note => note.id !== id),
      noteTargets: state.noteTargets.filter(target => target.noteId !== id)
    })),

  deleteNotes: ids =>
    set(state => ({
      notes: state.notes.filter(note => !ids.includes(note.id)),
      noteTargets: state.noteTargets.filter(target => !ids.includes(target.noteId))
    }))
}))

/** One note by id - the sheet, the panel and the record page all resolve their subject here (SSOT). */
export const useNote = (id?: string): Note | undefined =>
  useNotesStore(state => (id ? state.notes.find(note => note.id === id) : undefined))

/** The records a note concerns, in join-row order. */
export const useNoteRefs = (noteId?: string): RecordRef[] => {
  const noteTargets = useNotesStore(state => state.noteTargets)

  return useMemo(
    () => (noteId ? targetRefs(noteTargets.filter(target => target.noteId === noteId)) : []),
    [noteTargets, noteId]
  )
}

export const useEntityNotes = (entityType: ParentEntityType, entityId: string): Note[] => {
  const notes = useNotesStore(state => state.notes)
  const noteTargets = useNotesStore(state => state.noteTargets)

  return useMemo(() => {
    const noteIds = new Set(
      noteTargets.filter(target => targetMatchesRef(target, entityType, entityId)).map(target => target.noteId)
    )

    return notes.filter(note => noteIds.has(note.id))
  }, [notes, noteTargets, entityType, entityId])
}

export const useNoteNavigation = (id: string) => {
  const notes = useNotesStore(state => state.notes)

  return useMemo(() => {
    const index = notes.findIndex(note => note.id === id)

    return {
      index,
      total: notes.length,
      previousId: index > 0 ? notes[index - 1].id : undefined,
      nextId: index >= 0 && index < notes.length - 1 ? notes[index + 1].id : undefined
    }
  }, [notes, id])
}
