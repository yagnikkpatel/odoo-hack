'use client'

// React Imports
import { useEffect } from 'react'

// Type Imports
import type { Note } from '@/features/nexacrm/types/apps/note-types'
import type { NoteTarget } from '@/features/nexacrm/types/apps/record-target'

// Store Imports
import { useNotesStore } from '@/features/nexacrm/store/use-notes-store'

const NotesStoreHydrator = ({ data }: { data: { notes: Note[]; noteTargets: NoteTarget[] } }) => {
  useEffect(() => {
    useNotesStore.getState().initialize(data)
  }, [data])

  return null
}

export default NotesStoreHydrator
