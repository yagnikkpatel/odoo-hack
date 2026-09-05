'use client'

// Third-party Imports
import { AlignLeftIcon, ArrowUpRightIcon, CalendarIcon, CircleDotIcon, UserPlusIcon } from 'lucide-react'

// Type Imports
import type { Note, NoteStatus } from '@/features/nexacrm/types/apps/note-types'
import { NO_NOTE_STATUS, noteStatusLabel, noteStatusTone } from '@/features/nexacrm/types/apps/note-types'

// Component Imports
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import RecordField from '@/features/nexacrm/components/record/record-field'
import StageBadge from '@/features/nexacrm/components/kanban/stage-badge'
import { RecordTargetsField } from '@/features/nexacrm/components/record/record-targets'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import UserChip from '@/features/nexacrm/components/record/user-chip'

// Store Imports
import { useNoteRefs, useNotesStore } from '@/features/nexacrm/store/use-notes-store'
import { useNoteStagesStore } from '@/features/nexacrm/store/use-note-stages-store'
import { useStageOptions } from '@/features/nexacrm/store/create-stages-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { formatDate } from '@/features/nexacrm/utils/format'

export const NoteBodyEditor = ({ note, canEdit, className }: { note: Note; canEdit: boolean; className?: string }) => {
  const updateNote = useNotesStore(state => state.updateNote)

  return canEdit ? (
    <Textarea
      value={note.body}
      aria-label='Note body'
      placeholder='Start writing…'
      onChange={event => updateNote(note.id, { body: event.target.value })}
      className={cn(
        'resize-none border-transparent text-sm leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent',
        className ?? 'min-h-64'
      )}
    />
  ) : (
    <p className='text-muted-foreground text-sm leading-relaxed whitespace-pre-line'>
      {note.body || 'This note is empty.'}
    </p>
  )
}

/** The heading above a record's own prose, matching the sub-record sheet. */
export const NoteBodyHeading = () => (
  <h3 className='flex items-center gap-1.5 text-sm font-medium'>
    <AlignLeftIcon className='text-muted-foreground size-3.5' /> Note
  </h3>
)

const NoteFields = ({ note, canEdit }: { note: Note; canEdit: boolean }) => {
  const updateNote = useNotesStore(state => state.updateNote)
  const setNoteTargets = useNotesStore(state => state.setNoteTargets)
  const refs = useNoteRefs(note.id)

  const stageOptions = useStageOptions(useNoteStagesStore)

  return (
    <div className='space-y-4'>
      <RecordGroup title='General'>
        <RecordField
          label='Body'
          icon={AlignLeftIcon}
          canEdit={canEdit}
          value={note.body}
          placeholder='Add a body'
          onCommit={raw => updateNote(note.id, { body: raw })}
        />

        <RecordField
          type='select'
          label='Status'
          icon={CircleDotIcon}
          canEdit={canEdit}
          value={note.status ?? NO_NOTE_STATUS}
          options={stageOptions}
          onChange={value =>
            updateNote(note.id, { status: value === NO_NOTE_STATUS ? undefined : (value as NoteStatus) })
          }
        >
          <StageBadge
            stagesStore={useNoteStagesStore}
            stage={note.status ?? NO_NOTE_STATUS}
            fallbackLabel={noteStatusLabel(note.status)}
            fallbackTone={noteStatusTone(note.status)}
          />
        </RecordField>

        <RecordField type='static' label='Relations' icon={ArrowUpRightIcon}>
          <RecordTargetsField refs={refs} canEdit={canEdit} onChange={next => setNoteTargets(note.id, next)} />
        </RecordField>
      </RecordGroup>

      <RecordGroup title='System'>
        <RecordField type='static' label='Created' icon={CalendarIcon}>
          <span className='text-sm'>{formatDate(note.createdAt)}</span>
        </RecordField>
        <RecordField type='static' label='Created by' icon={UserPlusIcon}>
          <UserChip userId={note.createdById} />
        </RecordField>
      </RecordGroup>
    </div>
  )
}

export default NoteFields
