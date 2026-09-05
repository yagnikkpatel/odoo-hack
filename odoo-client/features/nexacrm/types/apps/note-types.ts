// Util Imports
import type { BadgeTone } from '@/features/nexacrm/lib/badge-tone'

export const NOTE_STATUSES = ['idea', 'shared', 'archived'] as const

export type NoteStatus = (typeof NOTE_STATUSES)[number] | (string & {})

export const NOTE_STATUS_LABELS: Record<string, string> = {
  idea: 'Idea',
  shared: 'Shared',
  archived: 'Archived'
}

export const NOTE_STATUS_TONES: Record<string, BadgeTone> = {
  idea: 'info',
  shared: 'success',
  archived: 'neutral'
}

const humanize = (status: string) => status.replace(/[_-]+/g, ' ').replace(/^./, character => character.toUpperCase())

/** Display label for any status - seeded, custom, or unset. */
export const noteStatusLabel = (status?: NoteStatus): string =>
  status ? (NOTE_STATUS_LABELS[status] ?? humanize(status)) : 'No status'

/** Badge tone for any status; a custom one is neutral until someone assigns it a meaning. */
export const noteStatusTone = (status?: NoteStatus): BadgeTone =>
  status ? (NOTE_STATUS_TONES[status] ?? 'neutral') : 'neutral'

export const NO_NOTE_STATUS = 'none'

export const NOTE_STATUS_OPTIONS = [
  { label: 'No status', value: NO_NOTE_STATUS },
  ...NOTE_STATUSES.map(status => ({ label: NOTE_STATUS_LABELS[status], value: status }))
]

export type Note = {
  id: string
  title: string

  body: string

  status?: NoteStatus

  createdById?: string
  updatedById?: string
  createdAt: string
  updatedAt: string
}

export type NoteInput = Omit<Note, 'id' | 'createdAt' | 'updatedAt'>

export const buildBlankNoteInput = (): NoteInput => ({ title: '', body: '' })

/** Display name for a note whose title has not been filled in yet. */
export const noteDisplayName = (note: Pick<Note, 'title'>): string => note.title.trim() || 'Untitled'

export const NOTE_FIELD_LABELS: Partial<Record<keyof Note, string>> = {
  title: 'Title',
  body: 'Body',
  status: 'Status'
}
